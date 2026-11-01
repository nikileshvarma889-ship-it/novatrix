// Renders the app icon + splash from HTML, then writes every Android density.
// Usage: node scripts/icons.mjs   (needs Playwright's Chromium and FFmpeg)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // global install is fine (NODE_PATH)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const res = "android/app/src/main/res";
const mark = (size, bg) => `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg}">
  <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.5" y="5" width="15" height="14" rx="3" fill="rgba(255,255,255,.18)"/><path d="M17.5 10l4-2.5v9l-4-2.5"/>
    <path d="M9 9.2l1 2.1 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="#fff" stroke="none"/></svg></body></html>`;
const grad = "linear-gradient(135deg,#5b6cff,#9b7bff)";

const b = await chromium.launch();
const shot = async (html, w, h, out, transparent = false) => {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html);
  await p.screenshot({ path: out, omitBackground: transparent });
  await p.close();
};
await shot(mark(1024, grad).replace("background:" + grad, `background:${grad};border-radius:0`), 1024, 1024, "assets/icon.png");
await shot(`<html><body style="margin:0;width:1024px;height:1024px;display:grid;place-items:center;background:transparent">${mark(560, "transparent").replace(/<\/?html>|<\/?body[^>]*>/g, "")}</body></html>`, 1024, 1024, "assets/icon-foreground.png", true);
await shot(`<html><body style="margin:0;width:2732px;height:2732px;display:grid;place-items:center;background:#f7f9ff;font-family:system-ui">
  <div style="display:flex;flex-direction:column;align-items:center;gap:60px"><div style="width:520px;height:520px;border-radius:140px;background:${grad};display:grid;place-items:center;box-shadow:0 60px 120px -40px rgba(91,108,255,.6)">${mark(520, "transparent").replace(/<\/?html>|<\/?body[^>]*>/g, "")}</div>
  <div style="font-size:150px;font-weight:800;color:#1b2140;letter-spacing:-3px">Reelwise</div></div></body></html>`, 2732, 2732, "assets/splash.png");
await b.close();

const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);
const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, s] of Object.entries(sizes)) {
  const dir = path.join(res, `mipmap-${d}`);
  ff(["-i", "assets/icon.png", "-vf", `scale=${s}:${s}`, path.join(dir, "ic_launcher.png")]);
  // Round icon: circle-masked copy.
  ff(["-i", "assets/icon.png", "-vf", `scale=${s}:${s},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-${s / 2},Y-${s / 2}),${s / 2}),255,0)'`, "-pix_fmt", "rgba", path.join(dir, "ic_launcher_round.png")]);
  const fg = Math.round(s * 2.25);
  ff(["-i", "assets/icon-foreground.png", "-vf", `scale=${fg}:${fg}`, path.join(dir, "ic_launcher_foreground.png")]);
}
// Adaptive icon background colour.
const bg = path.join(res, "values", "ic_launcher_background.xml");
fs.writeFileSync(bg, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#6B6EFF</color>\n</resources>\n`);
// Splash screens: fill every existing splash.png at its own size.
for (const dir of fs.readdirSync(res).filter((x) => x.startsWith("drawable"))) {
  const f = path.join(res, dir, "splash.png");
  if (!fs.existsSync(f)) continue;
  const [w, h] = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", f], { encoding: "utf8" }).trim().split(",").map(Number);
  ff(["-i", "assets/splash.png", "-vf", `scale=${Math.max(w, h)}:${Math.max(w, h)},crop=${w}:${h}`, f]);
}
console.log("icons and splash screens written");
