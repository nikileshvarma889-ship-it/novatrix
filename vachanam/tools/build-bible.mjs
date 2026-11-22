// Builds assets/bible/bible.db from the licensed USFM sources (run: npm run build:bible).
//   Telugu: Indian Revised Version (IRV) 2019, © 2017, 2019 Bridge Connectivity Solutions, CC BY-SA 4.0  (eBible.org: tel2017)
//   English: Berean Standard Bible (BSB), public domain                                                     (eBible.org: engbsb)
// The verse text is kept exactly as published. Only markup is converted: footnotes and cross-reference
// markers are omitted, word-level tags (e.g. Strong's numbers) are removed, headings and paragraph breaks kept.
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CACHE = process.env.BIBLE_CACHE || path.join(os.tmpdir(), "vachanam-usfm");
const OUT = path.join(ROOT, "assets/bible/bible.db");

export const TRANSLATIONS = [
  { id: "tel_irv", ebible: "tel2017", language: "te", name: "ఇండియన్ రివైజ్డ్ వెర్షన్ (IRV) తెలుగు - 2019", short_name: "IRV",
    copyright: "Indian Revised Version (IRV) Telugu - 2019. Copyright © 2017, 2019 Bridge Connectivity Solutions. Licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). Source: eBible.org. Changes: formatting converted for display; footnotes omitted; verse text unchanged.",
    license: "CC BY-SA 4.0", source_url: "https://ebible.org/find/details.php?id=tel2017" },
  { id: "eng_bsb", ebible: "engbsb", language: "en", name: "Berean Standard Bible", short_name: "BSB",
    copyright: "The Holy Bible, Berean Standard Bible (BSB). Public domain. Source: eBible.org.",
    license: "Public domain", source_url: "https://ebible.org/find/details.php?id=engbsb" },
];

function fetchUsfm(code) {
  const dir = path.join(CACHE, code);
  if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith(".usfm"))) return dir;
  fs.mkdirSync(dir, { recursive: true });
  const zip = path.join(CACHE, `${code}.zip`);
  execFileSync("curl", ["-sSfL", "-m", "180", "-o", zip, `https://ebible.org/Scriptures/${code}_usfm.zip`]);
  execFileSync("unzip", ["-qo", zip, "-d", dir]);
  return dir;
}

/** Converts USFM inline markup in one verse/heading to plain text. */
export function cleanInline(s) {
  return s
    .replace(/\\f\s.*?\\f\*/gs, "")                    // footnotes
    .replace(/\\x\s.*?\\x\*/gs, "")                    // cross references
    .replace(/\\\+?w\s+([^|\\]*?)(?:\|[^\\]*?)?\\\+?w\*/g, "$1") // \w word|attrs\w*
    .replace(/\\\+?[a-z]+\d*\*?/g, "")                 // remaining character markers (\wj, \add, \nd, \qs, \bd ...)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?”’)])/g, "$1")
    .trim();
}

const PARA = /^(p|m|pi\d?|pmo|pc|nb|b|li\d?|q\d?|qr|qc|qm\d?|pr|mi)$/;
const HEAD = /^(s\d?|ms\d?|d|qa)$/;

export function parseBook(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const meta = {}; const verses = []; const headings = [];
  let chapter = 0, cur = null, pendingPara = false, pendingPoetry = false;
  const flush = () => { if (cur) { cur.text = cleanInline(cur.raw); delete cur.raw; verses.push(cur); cur = null; } };
  for (const line of lines) {
    const m = /^\\([a-z]+\d*)\s?(.*)$/.exec(line.trim());
    if (!m) { if (cur) cur.raw += " " + line; continue; }
    const [, tag, rest] = m;
    if (["id", "h", "toc1", "toc2", "toc3"].includes(tag)) { meta[tag] = rest.trim(); continue; }
    if (tag === "c") { flush(); chapter = parseInt(rest, 10); pendingPara = true; continue; }
    if (chapter === 0) continue;                          // introductions, titles
    if (tag === "v") {
      flush();
      const vm = /^(\d+)(?:[-–](\d+))?\s*(.*)$/s.exec(rest);
      cur = { chapter, verse: +vm[1], vto: vm[2] ? +vm[2] : null, para: pendingPara ? 1 : 0, poetry: pendingPoetry ? 1 : 0, raw: vm[3] };
      pendingPara = false; continue;
    }
    if (HEAD.test(tag)) {
      flush();
      const t = cleanInline(rest);
      if (t) headings.push({ chapter, before: (verses.filter((v) => v.chapter === chapter).at(-1)?.verse ?? 0) + 1, level: tag === "d" ? 9 : parseInt(tag.replace(/\D/g, "") || "1", 10), text: t });
      pendingPara = true; continue;
    }
    if (PARA.test(tag)) { flush(); pendingPara = true; pendingPoetry = /^q/.test(tag); if (rest.trim()) { /* text after a paragraph marker belongs to the open verse */ } continue; }
    if (cur) cur.raw += " " + line.trim().replace(/^\\[a-z]+\d*\s?/, (x) => (/^\\(f|x|w|wj|add|nd|qs|bd|it)\b/.test(x) ? x : ""));
  }
  flush();
  return { meta, verses, headings };
}

function main() {
  const src = fs.readFileSync(path.join(ROOT, "src/data/books.ts"), "utf8");
  const books = [...src.matchAll(/code: "(\w+)", order: (\d+), name: "([^"]+)", testament: "(OT|NT)", chapters: (\d+)/g)]
    .map(([, code, order, name, testament, chapters]) => ({ code, order: +order, name, testament, chapters: +chapters }));
  if (books.length !== 66) throw new Error(`expected 66 books in books.ts, found ${books.length}`);
  const byCode = Object.fromEntries(books.map((b) => [b.code, b]));
  fs.rmSync(OUT, { force: true });
  const db = new DatabaseSync(OUT);
  db.exec(`
    PRAGMA journal_mode = DELETE;
    CREATE TABLE translations (id TEXT PRIMARY KEY, language TEXT NOT NULL, name TEXT NOT NULL, short_name TEXT NOT NULL, copyright TEXT NOT NULL, license TEXT NOT NULL, source_url TEXT NOT NULL);
    CREATE TABLE book_names (translation_id TEXT NOT NULL, book TEXT NOT NULL, name TEXT NOT NULL, short_name TEXT NOT NULL, abbr TEXT, PRIMARY KEY (translation_id, book));
    CREATE TABLE verses (translation_id TEXT NOT NULL, vid INTEGER NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, vto INTEGER, para INTEGER NOT NULL DEFAULT 0, poetry INTEGER NOT NULL DEFAULT 0, text TEXT NOT NULL, PRIMARY KEY (translation_id, vid)) WITHOUT ROWID;
    CREATE INDEX verses_chapter ON verses (translation_id, book, chapter, verse);
    CREATE TABLE headings (translation_id TEXT NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, before_verse INTEGER NOT NULL, level INTEGER NOT NULL, text TEXT NOT NULL);
    CREATE INDEX headings_chapter ON headings (translation_id, book, chapter);
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const insT = db.prepare("INSERT INTO translations VALUES (?,?,?,?,?,?,?)");
  const insB = db.prepare("INSERT INTO book_names VALUES (?,?,?,?,?)");
  const insV = db.prepare("INSERT INTO verses VALUES (?,?,?,?,?,?,?,?,?)");
  const insH = db.prepare("INSERT INTO headings VALUES (?,?,?,?,?,?)");
  const report = {};
  db.exec("BEGIN");
  for (const t of TRANSLATIONS) {
    insT.run(t.id, t.language, t.name, t.short_name, t.copyright, t.license, t.source_url);
    const dir = fetchUsfm(t.ebible);
    let nv = 0, nh = 0, problems = [];
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".usfm")).sort()) {
      const { meta, verses, headings } = parseBook(fs.readFileSync(path.join(dir, f), "utf8"));
      const code = (meta.id || "").split(/\s/)[0];
      const b = byCode[code];
      if (!b) continue;                                   // front matter etc.
      insB.run(t.id, code, meta.toc1 || meta.h, meta.toc2 || meta.h, meta.toc3 || null);
      const chs = new Set(verses.map((v) => v.chapter));
      if (chs.size !== b.chapters) problems.push(`${code}: ${chs.size} chapters (expected ${b.chapters})`);
      const seen = new Set();
      for (const v of verses) {
        const vid = b.order * 1_000_000 + v.chapter * 1000 + v.verse;
        if (seen.has(vid)) { problems.push(`${code} ${v.chapter}:${v.verse} duplicated`); continue; }
        seen.add(vid);
        if (!v.text) problems.push(`${code} ${v.chapter}:${v.verse} empty`);
        insV.run(t.id, vid, code, v.chapter, v.verse, v.vto, v.para, v.poetry, v.text); nv++;
      }
      for (const h of headings) { insH.run(t.id, code, h.chapter, h.before, h.level, h.text); nh++; }
    }
    report[t.id] = { verses: nv, headings: nh, problems };
  }
  db.prepare("INSERT INTO meta VALUES ('built_at', ?)").run(new Date().toISOString());
  db.prepare("INSERT INTO meta VALUES ('schema', '1')").run();
  db.exec("COMMIT"); db.exec("VACUUM"); db.close();
  console.log(JSON.stringify(report, null, 1));
  console.log("wrote", OUT, (fs.statSync(OUT).size / 1e6).toFixed(1), "MB");
}
if (import.meta.url === `file://${process.argv[1]}`) main();
