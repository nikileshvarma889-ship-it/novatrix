// Turns the Expo web export (dist-web) into a self-contained page that works at any URL path,
// e.g. as a claude.ai artifact:  node tools/make-artifact.mjs <web-export-dir> <out-dir>
// - every absolute "/_expo/…" and "/assets/…" string in the bundles becomes (page folder + path), computed at load
// - scripts are loaded by a small inline loader after the page folder is known
// - the frame's path is reset to "/" so Expo Router starts on Home (assets keep loading from the page folder)
import fs from "node:fs";
import path from "node:path";

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error("usage: node tools/make-artifact.mjs <web-export-dir> <out-dir>");
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

const PREFIX = `(self.__VB||"")+`;
const WORKER_PRELUDE = `self.__VB=self.__VB||String((self.location&&self.location.href)||"").replace(/\\/v?_expo\\/static\\/js\\/web\\/[^/]*$/,"");\n`;
let patched = 0;
for (const f of walk(out)) {
  if (!f.endsWith(".js")) continue;
  const s = fs.readFileSync(f, "utf8");
  const t = s.replace(/(?<![\w$\]).])(["'`])\/(_expo|assets)\//g, (m, q, dir) => { patched++; return `${PREFIX}${q}/${dir}/`; });
  // In a worker (e.g. the SQLite engine) the page folder comes from the worker's own URL: <folder>/_expo/static/js/web/worker-….js
  if (t !== s) fs.writeFileSync(f, WORKER_PRELUDE + t);
}

// Hosts may reserve names that start with "_" (claude.ai does): rename such folders/files and every reference to them.
const renames = [];
for (const f of walk(out)) {
  const rel = path.relative(out, f).split(path.sep);
  if (rel.some((seg) => seg.startsWith("_"))) renames.push([rel.join("/"), rel.map((seg) => (seg.startsWith("_") ? "v" + seg : seg)).join("/")]);
}
const segMap = new Map();
for (const [from, to] of renames) from.split("/").forEach((seg, i) => { if (seg.startsWith("_")) segMap.set(seg, to.split("/")[i]); });
for (const [from, to] of renames) { fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true }); fs.renameSync(path.join(out, from), path.join(out, to)); }
for (const d of fs.readdirSync(out)) if (d.startsWith("_")) fs.rmSync(path.join(out, d), { recursive: true, force: true });
const segRe = new RegExp("/(" + [...segMap.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|") + ")(?=[/\"'`])", "g");
for (const f of walk(out)) {
  if (!/\.(js|html)$/.test(f)) continue;
  const s0 = fs.readFileSync(f, "utf8");
  const s1 = s0.replace(segRe, (m, seg) => "/" + segMap.get(seg));
  if (s1 !== s0) fs.writeFileSync(f, s1);
}
console.log(`renamed ${renames.length} files with reserved "_" names`);

const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="(\/v?_expo\/[^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
const loader = `<script>
(function () {
  var dir = location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "").replace(/\\/$/, "");
  self.__VB = dir;
  try { history.replaceState(null, "", "/" + location.hash); } catch (e) {}
  ${JSON.stringify(scripts)}.forEach(function (p) { var s = document.createElement("script"); s.src = dir + p; s.async = false; document.body.appendChild(s); });
})();
</script>`;
let page = html.replace(/<script src="\/v?_expo\/[^"]+"[^>]*><\/script>/g, "").replace(/<link rel="icon"[^>]*>/, "");
page = page.replace("</body>", `${loader}\n</body>`);
if (!/^<!DOCTYPE html>/i.test(page.trim())) page = "<!DOCTYPE html>\n" + page.replace(/^<!doctype html>\s*/i, "");
page = page.replace('<meta httpEquiv="X-UA-Compatible" content="IE=edge" />', "");
fs.writeFileSync(path.join(out, "index.html"), page);
console.log(`patched ${patched} path literals in bundles; loader for ${scripts.length} scripts`);

function* walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) yield* walk(p); else yield p; } }
