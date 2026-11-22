// Sanity checks for assets/bible/bible.db (run: node tools/check-bible.mjs). Exits non-zero on failure.
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(new URL("../assets/bible/bible.db", import.meta.url).pathname, { readOnly: true });
const one = (sql, ...a) => db.prepare(sql).get(...a);
const all = (sql, ...a) => db.prepare(sql).all(...a);
const fails = [];
const check = (name, ok, detail) => { console.log(ok ? "PASS" : "FAIL", name, detail ?? ""); if (!ok) fails.push(name); };
for (const t of ["tel_irv", "eng_bsb"]) {
  const markup = one("SELECT COUNT(*) n FROM verses WHERE translation_id = ? AND (instr(text, char(92)) > 0 OR instr(text, 'strong=') > 0 OR instr(text, '|') > 0)", t).n;
  check(`${t}: no leftover USFM markup`, markup === 0, markup);
  check(`${t}: no empty verses`, one("SELECT COUNT(*) n FROM verses WHERE translation_id = ? AND length(trim(text)) = 0", t).n === 0);
  check(`${t}: 1189 chapters`, one("SELECT COUNT(DISTINCT book || '.' || chapter) c FROM verses WHERE translation_id = ?", t).c === 1189);
  check(`${t}: 66 book names`, one("SELECT COUNT(*) n FROM book_names WHERE translation_id = ?", t).n === 66);
  check(`${t}: John 3:16 present`, !!one("SELECT 1 FROM verses WHERE translation_id = ? AND vid = 43003016", t));
}
const unmatched = one(`SELECT COUNT(*) n FROM verses b WHERE b.translation_id = 'eng_bsb' AND NOT EXISTS (
  SELECT 1 FROM verses t WHERE t.translation_id = 'tel_irv' AND t.book = b.book AND t.chapter = b.chapter AND b.verse BETWEEN t.verse AND IFNULL(t.vto, t.verse))`).n;
check("parallel alignment: English verses with a Telugu counterpart", unmatched < 200, `${unmatched} unmatched of 31086`);
console.log("Telugu short names:", all("SELECT book, short_name FROM book_names WHERE translation_id = 'tel_irv' AND book IN ('GEN','PSA','JHN','REV')").map((r) => `${r.book}=${r.short_name}`).join(", "));
console.log("verse ranges in IRV:", one("SELECT COUNT(*) n FROM verses WHERE translation_id = 'tel_irv' AND vto IS NOT NULL").n);
if (fails.length) process.exit(1);
