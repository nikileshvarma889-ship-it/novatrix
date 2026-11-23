// Builds the Bible for the shareable web link: Telugu IRV (CC BY-SA) from assets/bible/bible.db
// + English KJV (public domain) from the personal import. The personal Telugu text is NOT included.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
const out = "assets/bible/personal/link.db";
fs.rmSync(out, { force: true });
const db = new DatabaseSync(out);
db.exec("ATTACH DATABASE 'assets/bible/bible.db' AS base; ATTACH DATABASE 'assets/bible/personal/bible.db' AS wp;");
for (const r of db.prepare("SELECT sql FROM base.sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type = 'index'").all()) db.exec(r.sql);
db.exec(`BEGIN;
  INSERT INTO translations SELECT * FROM base.translations WHERE id = 'tel_irv';
  INSERT INTO translations SELECT * FROM wp.translations WHERE id = 'eng_kjv';
  INSERT INTO book_names SELECT * FROM base.book_names WHERE translation_id = 'tel_irv';
  INSERT INTO book_names SELECT * FROM wp.book_names WHERE translation_id = 'eng_kjv';
  INSERT INTO verses SELECT * FROM base.verses WHERE translation_id = 'tel_irv';
  INSERT INTO verses SELECT * FROM wp.verses WHERE translation_id = 'eng_kjv';
  INSERT INTO headings SELECT * FROM base.headings WHERE translation_id = 'tel_irv';
  INSERT INTO meta SELECT * FROM base.meta;
  UPDATE translations SET copyright = 'King James Version, public domain (outside the UK).' WHERE id = 'eng_kjv';
  COMMIT;`);
db.exec("DETACH DATABASE base; DETACH DATABASE wp; VACUUM;");
console.log(db.prepare("SELECT translation_id, COUNT(*) AS n FROM verses GROUP BY 1").all().map((r) => `${r.translation_id}:${r.n}`).join(" "));
