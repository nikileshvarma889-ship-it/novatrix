import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./sqlite-adapter";
import { migrate } from "../src/db/schema";
import * as M from "../src/lib/marks";

async function fresh() { const db: any = testDb(); await migrate(db); return db; }
const J = (verse: number) => ({ book: "JHN", chapter: 3, verse });

test("migrations run cleanly and seed the five starter collections", async () => {
  const db = await fresh();
  await migrate(db);                                   // idempotent
  assert.deepEqual((await M.listCollections(db)).map((c) => c.name), ["Faith", "Prayer", "Hope", "Love", "Promises of God"]);
});

test("highlights: set, change colour, remove, and they're keyed to the verse", async () => {
  const db = await fresh();
  await M.setHighlight(db, [J(16), J(17)], "yellow");
  await M.setHighlight(db, [J(16)], "green");
  let m = await M.loadChapterMarks(db, "JHN", 3);
  assert.deepEqual(m.highlights, { 16: "green", 17: "yellow" });
  await M.setHighlight(db, [J(17)], null);
  m = await M.loadChapterMarks(db, "JHN", 3);
  assert.deepEqual(m.highlights, { 16: "green" });
  assert.deepEqual((await M.loadChapterMarks(db, "JHN", 30)).highlights, {}, "JHN 30 must not see JHN 3 marks");
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) n FROM highlights")).n, 2, "re-highlighting reuses the row");
});

test("underlines: linked in parallel, per-language otherwise, removable", async () => {
  const db = await fresh();
  await M.setUnderlines(db, [J(16)], () => ({ te: true, en: true }));            // parallel: both
  await M.setUnderlines(db, [J(17)], (u) => ({ ...u, te: true }));               // Telugu only
  let u = (await M.loadChapterMarks(db, "JHN", 3)).underlines;
  assert.deepEqual(u, { 16: { te: true, en: true }, 17: { te: true, en: false } });
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) n FROM underlines WHERE ref = 'JHN.3.16' AND deleted = 0 AND translation_id IS NULL")).n, 1, "linked = one row");
  await M.setUnderlines(db, [J(16)], (c) => ({ ...c, en: false }));             // remove English only
  await M.setUnderlines(db, [J(17)], (c) => ({ ...c, en: true }));              // now both
  u = (await M.loadChapterMarks(db, "JHN", 3)).underlines;
  assert.deepEqual(u, { 16: { te: true, en: false }, 17: { te: true, en: true } });
  await M.setUnderlines(db, [J(16), J(17)], () => ({ te: false, en: false }));
  assert.deepEqual((await M.loadChapterMarks(db, "JHN", 3)).underlines, {});
});

test("bookmarks: verses, chapters, favourites, removal", async () => {
  const db = await fresh();
  await M.setVerseBookmarks(db, [J(16)], true);
  await M.setChapterBookmark(db, "JHN", 3, true);
  let m = await M.loadChapterMarks(db, "JHN", 3);
  assert.ok(m.bookmarked.has(16)); assert.ok(m.chapterBookmarked);
  const id = (await db.getFirstAsync("SELECT id FROM bookmarks WHERE kind = 'verse'")).id;
  await M.setFavourite(db, id, true);
  assert.equal((await db.getFirstAsync("SELECT favourite FROM bookmarks WHERE id = ?", [id])).favourite, 1);
  await M.setVerseBookmarks(db, [J(16)], false); await M.setChapterBookmark(db, "JHN", 3, false);
  m = await M.loadChapterMarks(db, "JHN", 3);
  assert.equal(m.bookmarked.size, 0); assert.equal(m.chapterBookmarked, false);
  await M.setVerseBookmarks(db, [J(16)], true);
  assert.equal((await db.getFirstAsync("SELECT COUNT(*) n FROM bookmarks WHERE kind='verse'")).n, 1, "re-bookmark reuses the row (unique per ref)");
});

test("notes: verse and chapter notes, edit, delete; changes are queued for sync", async () => {
  const db = await fresh();
  const a = await M.createNote(db, { book: "JHN", chapter: 3, verse: 16 }, "God's love");
  const b = await M.createNote(db, { book: "JHN", chapter: 3 }, "Chapter thoughts");
  await M.updateNote(db, a, { title: "దేవుని ప్రేమ", body: "Telugu and English both work." });
  let m = await M.loadChapterMarks(db, "JHN", 3);
  assert.deepEqual(m.notes[16], [a]); assert.deepEqual(m.chapterNotes.map((n) => n.id), [b]);
  assert.equal((await db.getFirstAsync("SELECT title FROM notes WHERE id = ?", [a])).title, "దేవుని ప్రేమ");
  await M.deleteNote(db, a);
  m = await M.loadChapterMarks(db, "JHN", 3);
  assert.equal(m.notes[16], undefined);
  assert.ok((await db.getFirstAsync("SELECT COUNT(*) n FROM sync_queue")).n >= 4);
});

test("collections: create, add (no duplicates), remove, rename, delete", async () => {
  const db = await fresh();
  const id = await M.createCollection(db, "  Comfort  ");
  await M.addToCollection(db, id, [J(16), J(17)]);
  await M.addToCollection(db, id, [J(16)]);
  let c = (await M.listCollections(db)).find((x) => x.id === id)!;
  assert.equal(c.name, "Comfort"); assert.equal(c.n, 2);
  await M.removeFromCollection(db, id, "JHN.3.17");
  await M.renameCollection(db, id, "Comfort in grief");
  c = (await M.listCollections(db)).find((x) => x.id === id)!;
  assert.equal(c.n, 1); assert.equal(c.name, "Comfort in grief");
  await M.deleteCollection(db, id);
  assert.equal((await M.listCollections(db)).some((x) => x.id === id), false);
});

test("share text includes both languages, the reference and credits", () => {
  const s = M.shareText({ teBookName: "యోహాను", enBookName: "John", chapter: 3, mode: "parallel", verses: [{ verse: 16, te: "TE16", en: "EN16" }, { verse: 17, te: "TE17", en: "EN17" }] });
  assert.match(s, /TE16 TE17/); assert.match(s, /EN16 EN17/); assert.match(s, /యోహాను 3:16-17 \(IRV\) · John 3:16-17 \(BSB\)/);
  const en = M.shareText({ enBookName: "John", chapter: 3, mode: "english", verses: [{ verse: 16, en: "EN16" }, { verse: 18, en: "EN18" }] });
  assert.doesNotMatch(en, /IRV/); assert.match(en, /John 3:16,18 \(BSB\)/);
});
