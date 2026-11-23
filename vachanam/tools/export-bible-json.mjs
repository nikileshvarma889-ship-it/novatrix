// Exports assets/bible/bible.db to JSON for the web build (public/bible/), where a .db file can't be served:
//   meta.json      { schema: [CREATE …], tables: { translations, book_names, headings, meta } }
//   verses-<translation>.json   [[vid, book, chapter, verse, vto, para, poetry, text], …]
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
const root = new URL("..", import.meta.url).pathname;
const dbPath = process.argv[2] ? new URL(process.argv[2], "file://" + process.cwd() + "/").pathname : root + "assets/bible/bible.db";   // optional: another bible db
const db = new DatabaseSync(dbPath, { readOnly: true });
const out = root + "public/bible/";
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type = 'index', name").all().map((r) => r.sql);
const tables = Object.fromEntries(["translations", "book_names", "headings", "meta"].map((t) => [t, db.prepare(`SELECT * FROM ${t}`).all().map((r) => Object.values(r))]));
fs.writeFileSync(out + "meta.json", JSON.stringify({ schema, tables }));
for (const { id } of db.prepare("SELECT id FROM translations").all()) {
  const rows = db.prepare("SELECT vid, book, chapter, verse, vto, para, poetry, text FROM verses WHERE translation_id = ? ORDER BY vid").all(id).map((r) => Object.values(r));
  fs.writeFileSync(out + `verses-${id}.json`, "[\n" + rows.map((r) => JSON.stringify(r)).join(",\n") + "\n]");
}
for (const f of fs.readdirSync(out)) if (!f.startsWith("verses-") || tables.translations.some((t) => f === `verses-${t[0]}.json`)) console.log(f, (fs.statSync(out + f).size / 1e6).toFixed(1), "MB");
