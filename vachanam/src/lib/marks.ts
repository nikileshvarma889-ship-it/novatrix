import type { SQLiteDatabase } from "expo-sqlite";
import type { HighlightColor } from "../theme/colors";
import { makeRef, makeVid } from "./ref";
import { nowIso, uuid } from "./id";

/**
 * The user's marks on Scripture: highlights, underlines, bookmarks, notes and collections.
 * Everything is keyed by stable verse references ("JHN.3.16" / vid 43003016), never screen positions,
 * so marks survive restarts and appear in every reading mode. Deletes are soft (deleted = 1) and every
 * change is queued in sync_queue for cloud sync (Phase 6).
 */
export type Db = Pick<SQLiteDatabase, "getAllAsync" | "getFirstAsync" | "runAsync" | "withTransactionAsync">;
export type VerseKey = { book: string; chapter: number; verse: number };
export const TE_ID = "tel_irv";
export const EN_ID = "eng_bsb";

const queue = (db: Db, table: string, id: string) => db.runAsync("INSERT INTO sync_queue (table_name, row_id, queued_at) VALUES (?, ?, ?)", [table, id, nowIso()]);

// ---------------------------------------------------------------- chapter view
export type Underline = { te: boolean; en: boolean };
export type ChapterMarks = {
  highlights: Record<number, HighlightColor>;
  underlines: Record<number, Underline>;
  bookmarked: Set<number>;
  notes: Record<number, string[]>;          // verse -> note ids (newest first)
  chapterBookmarked: boolean;
  chapterNotes: { id: string; title: string }[];
};

export async function loadChapterMarks(db: Db, book: string, chapter: number): Promise<ChapterMarks> {
  const lo = makeVid(book, chapter, 1), hi = makeVid(book, chapter, 999);
  const [hl, ul, bm, notes, chBm] = await Promise.all([
    db.getAllAsync<{ vid: number; color: HighlightColor }>("SELECT vid, color FROM highlights WHERE deleted = 0 AND vid BETWEEN ? AND ?", [lo, hi]),
    db.getAllAsync<{ vid: number; translation_id: string | null }>("SELECT vid, translation_id FROM underlines WHERE deleted = 0 AND vid BETWEEN ? AND ?", [lo, hi]),
    db.getAllAsync<{ vid: number }>("SELECT vid FROM bookmarks WHERE deleted = 0 AND kind = 'verse' AND vid BETWEEN ? AND ?", [lo, hi]),
    db.getAllAsync<{ id: string; verse: number | null; title: string }>("SELECT id, verse, title FROM notes WHERE deleted = 0 AND book = ? AND chapter = ? ORDER BY updated_at DESC", [book, chapter]),
    db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM bookmarks WHERE deleted = 0 AND kind = 'chapter' AND ref = ?", [makeRef(book, chapter)]),
  ]);
  const v = (vid: number) => vid % 1000;
  const underlines: Record<number, Underline> = {};
  for (const u of ul) {
    const cur = (underlines[v(u.vid)] ??= { te: false, en: false });
    if (u.translation_id === null || u.translation_id === TE_ID) cur.te = true;
    if (u.translation_id === null || u.translation_id === EN_ID) cur.en = true;
  }
  const noteMap: Record<number, string[]> = {};
  for (const n of notes) if (n.verse) (noteMap[n.verse] ??= []).push(n.id);
  return {
    highlights: Object.fromEntries(hl.map((h) => [v(h.vid), h.color])),
    underlines,
    bookmarked: new Set(bm.map((b) => v(b.vid))),
    notes: noteMap,
    chapterBookmarked: (chBm?.n ?? 0) > 0,
    chapterNotes: notes.filter((n) => !n.verse).map((n) => ({ id: n.id, title: n.title })),
  };
}

// ---------------------------------------------------------------- highlights (verse-level, both languages)
export async function setHighlight(db: Db, verses: VerseKey[], color: HighlightColor | null) {
  await db.withTransactionAsync(async () => {
    for (const k of verses) {
      const ref = makeRef(k.book, k.chapter, k.verse), vid = makeVid(k.book, k.chapter, k.verse), t = nowIso();
      const row = await db.getFirstAsync<{ id: string }>("SELECT id FROM highlights WHERE ref = ? AND translation_id IS NULL", [ref]);
      if (row) await db.runAsync("UPDATE highlights SET color = ?, deleted = ?, updated_at = ? WHERE id = ?", [color ?? "yellow", color ? 0 : 1, t, row.id]);
      else if (color) await db.runAsync("INSERT INTO highlights (id, ref, vid, translation_id, color, updated_at) VALUES (?, ?, ?, NULL, ?, ?)", [uuid(), ref, vid, color, t]);
      const id = row?.id ?? (await db.getFirstAsync<{ id: string }>("SELECT id FROM highlights WHERE ref = ? AND translation_id IS NULL", [ref]))?.id;
      if (id) await queue(db, "highlights", id);
    }
  });
}

// ---------------------------------------------------------------- underlines (per language, linked when both)
/** Stores the wanted state for each verse: both languages -> one linked row (translation NULL); one language -> a row for it; none -> nothing. */
export async function setUnderlines(db: Db, verses: VerseKey[], next: (current: Underline) => Underline) {
  await db.withTransactionAsync(async () => {
    for (const k of verses) {
      const ref = makeRef(k.book, k.chapter, k.verse), vid = makeVid(k.book, k.chapter, k.verse), t = nowIso();
      const rows = await db.getAllAsync<{ id: string; translation_id: string | null; deleted: number }>("SELECT id, translation_id, deleted FROM underlines WHERE ref = ?", [ref]);
      const live = rows.filter((r) => !r.deleted);
      const cur: Underline = { te: live.some((r) => r.translation_id !== EN_ID), en: live.some((r) => r.translation_id !== TE_ID) };
      const want = next(cur);
      const wantRows: (string | null)[] = want.te && want.en ? [null] : want.te ? [TE_ID] : want.en ? [EN_ID] : [];
      for (const r of rows) {
        const keep = wantRows.includes(r.translation_id);
        if (keep !== !r.deleted) { await db.runAsync("UPDATE underlines SET deleted = ?, updated_at = ? WHERE id = ?", [keep ? 0 : 1, t, r.id]); await queue(db, "underlines", r.id); }
      }
      for (const tr of wantRows) if (!rows.some((r) => r.translation_id === tr)) {
        const id = uuid();
        await db.runAsync("INSERT INTO underlines (id, ref, vid, translation_id, updated_at) VALUES (?, ?, ?, ?, ?)", [id, ref, vid, tr, t]);
        await queue(db, "underlines", id);
      }
    }
  });
}

// ---------------------------------------------------------------- bookmarks
async function setBookmarkRow(db: Db, kind: "verse" | "chapter", ref: string, vid: number, on: boolean) {
  const t = nowIso();
  const row = await db.getFirstAsync<{ id: string }>("SELECT id FROM bookmarks WHERE kind = ? AND ref = ?", [kind, ref]);
  if (row) await db.runAsync("UPDATE bookmarks SET deleted = ?, updated_at = ? WHERE id = ?", [on ? 0 : 1, t, row.id]);
  else if (on) await db.runAsync("INSERT INTO bookmarks (id, kind, ref, vid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [uuid(), kind, ref, vid, t, t]);
  const id = row?.id ?? (await db.getFirstAsync<{ id: string }>("SELECT id FROM bookmarks WHERE kind = ? AND ref = ?", [kind, ref]))?.id;
  if (id) await queue(db, "bookmarks", id);
}
export async function setVerseBookmarks(db: Db, verses: VerseKey[], on: boolean) {
  await db.withTransactionAsync(async () => { for (const k of verses) await setBookmarkRow(db, "verse", makeRef(k.book, k.chapter, k.verse), makeVid(k.book, k.chapter, k.verse), on); });
}
export const setChapterBookmark = (db: Db, book: string, chapter: number, on: boolean) => setBookmarkRow(db, "chapter", makeRef(book, chapter), makeVid(book, chapter, 0), on);
export async function setFavourite(db: Db, bookmarkId: string, fav: boolean) {
  await db.runAsync("UPDATE bookmarks SET favourite = ?, updated_at = ? WHERE id = ?", [fav ? 1 : 0, nowIso(), bookmarkId]);
  await queue(db, "bookmarks", bookmarkId);
}
export async function removeBookmark(db: Db, bookmarkId: string) {
  await db.runAsync("UPDATE bookmarks SET deleted = 1, updated_at = ? WHERE id = ?", [nowIso(), bookmarkId]);
  await queue(db, "bookmarks", bookmarkId);
}

// ---------------------------------------------------------------- notes
export async function createNote(db: Db, at: { book: string; chapter: number; verse?: number | null }, title = ""): Promise<string> {
  const id = uuid(), t = nowIso();
  const ref = at.verse ? makeRef(at.book, at.chapter, at.verse) : makeRef(at.book, at.chapter);
  await db.runAsync("INSERT INTO notes (id, ref, book, chapter, verse, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)", [id, ref, at.book, at.chapter, at.verse ?? null, title, t, t]);
  await queue(db, "notes", id);
  return id;
}
export async function updateNote(db: Db, id: string, patch: { title: string; body: string }) {
  await db.runAsync("UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?", [patch.title, patch.body, nowIso(), id]);
  await queue(db, "notes", id);
}
export async function deleteNote(db: Db, id: string) {
  await db.runAsync("UPDATE notes SET deleted = 1, updated_at = ? WHERE id = ?", [nowIso(), id]);
  await queue(db, "notes", id);
}

// ---------------------------------------------------------------- collections
export type Collection = { id: string; name: string; n: number };
export const listCollections = (db: Db) => db.getAllAsync<Collection>(
  "SELECT c.id, c.name, (SELECT COUNT(*) FROM collection_items i WHERE i.collection_id = c.id AND i.deleted = 0) AS n FROM collections c WHERE c.deleted = 0 ORDER BY c.created_at, c.rowid");
export async function createCollection(db: Db, name: string): Promise<string> {
  const id = uuid(), t = nowIso();
  await db.runAsync("INSERT INTO collections (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", [id, name.trim(), t, t]);
  await queue(db, "collections", id);
  return id;
}
export async function renameCollection(db: Db, id: string, name: string) {
  await db.runAsync("UPDATE collections SET name = ?, updated_at = ? WHERE id = ?", [name.trim(), nowIso(), id]);
  await queue(db, "collections", id);
}
export async function deleteCollection(db: Db, id: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE collections SET deleted = 1, updated_at = ? WHERE id = ?", [nowIso(), id]);
    await db.runAsync("UPDATE collection_items SET deleted = 1 WHERE collection_id = ?", [id]);
    await queue(db, "collections", id);
  });
}
export async function addToCollection(db: Db, collectionId: string, verses: VerseKey[]) {
  await db.withTransactionAsync(async () => {
    for (const k of verses) {
      await db.runAsync(
        "INSERT INTO collection_items (collection_id, ref, vid, added_at, deleted) VALUES (?, ?, ?, ?, 0) ON CONFLICT (collection_id, ref) DO UPDATE SET deleted = 0, added_at = excluded.added_at",
        [collectionId, makeRef(k.book, k.chapter, k.verse), makeVid(k.book, k.chapter, k.verse), nowIso()]);
    }
    await queue(db, "collection_items", collectionId);
  });
}
export async function removeFromCollection(db: Db, collectionId: string, ref: string) {
  await db.runAsync("UPDATE collection_items SET deleted = 1 WHERE collection_id = ? AND ref = ?", [collectionId, ref]);
  await queue(db, "collection_items", collectionId);
}

/** Text for Copy / Share: both languages (as shown), the reference and the translation credits. */
export function shareText(opts: { teBookName?: string; enBookName: string; chapter: number; verses: { verse: number; te?: string; en?: string }[]; mode: "telugu" | "english" | "parallel" }): string {
  const nums = opts.verses.map((v) => v.verse);
  const span = nums.length > 1 && nums[nums.length - 1] - nums[0] === nums.length - 1 ? `${nums[0]}-${nums[nums.length - 1]}` : nums.join(",");
  const te = opts.mode !== "english" ? opts.verses.map((v) => v.te).filter(Boolean).join(" ") : "";
  const en = opts.mode !== "telugu" ? opts.verses.map((v) => v.en).filter(Boolean).join(" ") : "";
  const refs = [opts.mode !== "english" && opts.teBookName ? `${opts.teBookName} ${opts.chapter}:${span} (IRV)` : null, opts.mode !== "telugu" ? `${opts.enBookName} ${opts.chapter}:${span} (BSB)` : null].filter(Boolean).join(" · ");
  return [te, en, `— ${refs}`, "Shared from Vachanam"].filter(Boolean).join("\n\n");
}
