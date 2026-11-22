import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { alignChapter, type VerseRow } from "../src/bible/repo";
import { DAILY_REFS, dailyRef } from "../src/bible/daily";
import { makeVid, parseRef } from "../src/lib/ref";

const db = new DatabaseSync(new URL("../assets/bible/bible.db", import.meta.url).pathname, { readOnly: true });

test("every daily verse exists in both translations and the list has no duplicates", () => {
  assert.equal(new Set(DAILY_REFS).size, DAILY_REFS.length);
  for (const r of DAILY_REFS) {
    const p = parseRef(r)!;
    assert.ok(p, r);
    const vid = makeVid(p.book, p.chapter, p.verse);
    const n = (db.prepare("SELECT COUNT(*) n FROM verses WHERE vid = ? AND translation_id IN ('tel_irv','eng_bsb')").get(vid) as { n: number }).n;
    assert.equal(n, 2, `${r} missing`);
  }
});

test("daily verse changes every day and doesn't repeat within the list length", () => {
  const seen = new Set<string>();
  for (let i = 0; i < DAILY_REFS.length; i++) seen.add(dailyRef(new Date(2026, 0, 1 + i)));
  assert.equal(seen.size, DAILY_REFS.length);
  assert.notEqual(dailyRef(new Date(2026, 5, 1)), dailyRef(new Date(2026, 5, 2)));
});

test("parallel alignment pairs a Telugu verse range with each English verse it covers", () => {
  const v = (verse: number, vto: number | null = null): VerseRow => ({ vid: verse, verse, vto, para: 0, poetry: 0, text: `t${verse}` });
  const rows = alignChapter([v(1, 2), v(3), v(4)], [v(1), v(2), v(3), v(4), v(5)]);
  assert.deepEqual(rows.map((r) => [r.label, r.te?.verse ?? null, r.en.map((e) => e.verse)]), [["1-2", 1, [1, 2]], ["3", 3, [3]], ["4", 4, [4]], ["5", null, [5]]]);
});

test("real chapters align with nothing dropped (every chapter of the Bible)", () => {
  const chapters = db.prepare("SELECT DISTINCT book, chapter FROM verses WHERE translation_id = 'eng_bsb'").all() as { book: string; chapter: number }[];
  const get = db.prepare("SELECT vid, verse, vto, para, poetry, text FROM verses WHERE translation_id = ? AND book = ? AND chapter = ? ORDER BY verse");
  let te = 0, en = 0;
  for (const { book, chapter } of chapters) {
    const rows = alignChapter(get.all("tel_irv", book, chapter) as VerseRow[], get.all("eng_bsb", book, chapter) as VerseRow[]);
    te += rows.filter((r) => r.te).length; en += rows.reduce((n, r) => n + r.en.length, 0);
  }
  assert.equal(chapters.length, 1189); assert.equal(te, 31004); assert.equal(en, 31086);
});
