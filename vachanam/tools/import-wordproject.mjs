// PERSONAL-USE import of wordproject.org Bible files you downloaded yourself (not redistributable, never committed).
//   node tools/import-wordproject.mjs --te <dir with NN/C.html> --en <dir with N.pdf> --out <db path>
// Telugu: wordproject HTML chapters (one <span class="verse" id="N"> per verse).  English: wordproject KJV PDFs (pdftotext).
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const TE_DIR = arg("--te"), EN_DIR = arg("--en"), OUT = arg("--out");
if (!TE_DIR || !EN_DIR || !OUT) throw new Error("usage: --te <dir> --en <dir> --out <db>");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = fs.readFileSync(path.join(ROOT, "src/data/books.ts"), "utf8");
const BOOKS = [...src.matchAll(/code: "(\w+)", order: (\d+), name: "([^"]+)", testament: "(OT|NT)", chapters: (\d+)/g)].map(([, code, order, name, , chapters]) => ({ code, order: +order, name, chapters: +chapters }));

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const clean = (s) => decode(s.replace(/<[^>]+>/g, " ")).replace(/[¸]/g, "").replace(/\s+/g, " ").trim();

function teluguBook(b) {
  const dir = path.join(TE_DIR, String(b.order).padStart(2, "0"));
  const verses = []; let name = null;
  for (let ch = 1; ch <= b.chapters; ch++) {
    const f = path.join(dir, `${ch}.html`);
    if (!fs.existsSync(f)) throw new Error(`missing Telugu ${b.code} ${ch}`);
    const html = fs.readFileSync(f, "utf8");
    if (!name) { const hs = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => clean(m[1]).replace(/^<>/, "").trim()); name = hs.find((h) => h && !/word\s*project/i.test(h) && !/\d/.test(h)) ?? b.name; }
    const body = html.slice(html.indexOf('id="textBody"'));
    const end = body.search(/<\/div>/i);
    const text = end > 0 ? body.slice(0, end) : body;
    const parts = text.split(/<span class="verse" id="(\d+)">\s*\d+\s*<\/span>/i);
    for (let i = 1; i < parts.length; i += 2) {
      const t = clean(parts[i + 1] ?? "");
      if (!t) continue;
      const prev = verses.find((x) => x.chapter === ch && x.verse === +parts[i]);
      if (prev) prev.text += " " + t;                    // the source repeats a verse number: keep both parts in one verse
      else verses.push({ chapter: ch, verse: +parts[i], text: t });
    }
  }
  return { name, verses };
}

function englishBook(b) {
  const pdf = path.join(EN_DIR, `${b.order}.pdf`);
  const raw = execFileSync("pdftotext", [pdf, "-"]).toString();
  const lines = raw.split("\n").map((l) => l.replace(/\f/g, "").trim()).filter((l) =>
    l && !/^For other languages please go to/i.test(l) && !/^Wordproject®/.test(l) && !/^organization registered in Macau/i.test(l) && !/^Contact \| Disclaimer/.test(l));
  const verses = []; let ch = 0, cur = null, expect = 1;
  for (const l of lines) {
    const c = /^(?:CHAPTER|PSALM) (\d+)$/.exec(l);
    // verse 1 of each chapter carries no number; later numbers appear either before the text or on their own line
    if (c) { if (cur) verses.push(cur); ch = +c[1]; cur = { chapter: ch, verse: 1, text: "" }; expect = 2; continue; }
    if (!ch) continue;                                  // title + chapter index before chapter 1
    const v = /^(\d+)(?: (.*))?$/.exec(l);
    if (v && +v[1] === expect) { if (cur) verses.push(cur); cur = { chapter: ch, verse: +v[1], text: v[2] ?? "" }; expect++; continue; }
    if (cur) cur.text += " " + l;                       // wrapped line
  }
  if (cur) verses.push(cur);
  for (const v of verses) v.text = v.text.replace(/\s+/g, " ").trim();
  return verses;
}

fs.rmSync(OUT, { force: true }); fs.mkdirSync(path.dirname(OUT), { recursive: true });
const db = new DatabaseSync(OUT);
db.exec(`
  CREATE TABLE translations (id TEXT PRIMARY KEY, language TEXT NOT NULL, name TEXT NOT NULL, short_name TEXT NOT NULL, copyright TEXT NOT NULL, license TEXT NOT NULL, source_url TEXT NOT NULL);
  CREATE TABLE book_names (translation_id TEXT NOT NULL, book TEXT NOT NULL, name TEXT NOT NULL, short_name TEXT NOT NULL, abbr TEXT, PRIMARY KEY (translation_id, book));
  CREATE TABLE verses (translation_id TEXT NOT NULL, vid INTEGER NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, vto INTEGER, para INTEGER NOT NULL DEFAULT 0, poetry INTEGER NOT NULL DEFAULT 0, text TEXT NOT NULL, PRIMARY KEY (translation_id, vid)) WITHOUT ROWID;
  CREATE INDEX verses_chapter ON verses (translation_id, book, chapter, verse);
  CREATE TABLE headings (translation_id TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, before_verse INTEGER NOT NULL, level INTEGER NOT NULL, text TEXT NOT NULL);
  CREATE INDEX headings_chapter ON headings (translation_id, book, chapter);
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
const T = [
  { id: "tel_wp", language: "te", name: "పవిత్ర బైబిల్ (wordproject.org)", short_name: "తెలుగు", license: "Personal use only",
    copyright: "Telugu Bible text from wordproject.org, downloaded by the owner for personal reading. Not for redistribution or publication.", source_url: "https://www.wordproject.org/bibles/te/index.htm" },
  { id: "eng_kjv", language: "en", name: "King James Version (KJV)", short_name: "KJV", license: "Public domain",
    copyright: "King James Version, public domain (outside the UK). Text from wordproject.org.", source_url: "https://www.wordproject.org/bibles/kj/index.htm" },
];
const insT = db.prepare("INSERT INTO translations VALUES (?,?,?,?,?,?,?)"), insB = db.prepare("INSERT INTO book_names VALUES (?,?,?,?,?)"), insV = db.prepare("INSERT INTO verses VALUES (?,?,?,?,?,NULL,?,0,?)");
const report = { tel_wp: { verses: 0, problems: [] }, eng_kjv: { verses: 0, problems: [] } };
db.exec("BEGIN");
for (const t of T) insT.run(t.id, t.language, t.name, t.short_name, t.copyright, t.license, t.source_url);
for (const b of BOOKS) {
  const te = teluguBook(b), en = englishBook(b);
  insB.run("tel_wp", b.code, te.name, te.name, null);
  insB.run("eng_kjv", b.code, b.name, b.name, null);
  for (const [id, vs] of [["tel_wp", te.verses], ["eng_kjv", en]]) {
    const chs = new Set(vs.map((v) => v.chapter));
    if (chs.size !== b.chapters) report[id].problems.push(`${b.code}: ${chs.size}/${b.chapters} chapters`);
    const seen = new Set();
    for (const v of vs) {
      const vid = b.order * 1_000_000 + v.chapter * 1000 + v.verse;
      if (seen.has(vid)) { report[id].problems.push(`${b.code} ${v.chapter}:${v.verse} duplicate`); continue; }
      seen.add(vid); insV.run(id, vid, b.code, v.chapter, v.verse, v.verse === 1 ? 1 : 0, v.text); report[id].verses++;
    }
  }
}
db.prepare("INSERT INTO meta VALUES ('schema', '1'), ('built_at', ?), ('personal', '1')").run(new Date().toISOString());
db.exec("COMMIT"); db.exec("VACUUM"); db.close();
console.log(JSON.stringify(report, (k, v) => (Array.isArray(v) && v.length > 12 ? [...v.slice(0, 12), `…${v.length - 12} more`] : v), 1));
