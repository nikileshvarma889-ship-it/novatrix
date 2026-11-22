import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Local database (offline-first). Every user record is keyed by a stable verse reference,
 * never a screen position:  ref = "<BOOK>.<chapter>.<verse>"  e.g. "JHN.3.16"  (USFM book codes),
 * plus a sortable integer  vid = order*1_000_000 + chapter*1_000 + verse.
 * The same ref/vid identifies the verse in every translation, which is what keeps parallel reading,
 * linked underlines and notes in sync across Telugu and English.
 * Rows carry uuid ids, updated_at and deleted (soft delete) so they can sync to Supabase later.
 */
const MIGRATIONS: string[] = [
  // v1: user data + content tables
  `
  CREATE TABLE IF NOT EXISTS translations (
    id TEXT PRIMARY KEY, language TEXT NOT NULL, name TEXT NOT NULL, short_name TEXT NOT NULL,
    copyright TEXT NOT NULL, license TEXT NOT NULL, source_url TEXT NOT NULL, installed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS book_names (
    translation_id TEXT NOT NULL, book TEXT NOT NULL, name TEXT NOT NULL, short_name TEXT,
    PRIMARY KEY (translation_id, book)
  );
  CREATE TABLE IF NOT EXISTS verses (
    translation_id TEXT NOT NULL, vid INTEGER NOT NULL, book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
    text TEXT NOT NULL, PRIMARY KEY (translation_id, vid)
  );
  CREATE INDEX IF NOT EXISTS verses_chapter ON verses (translation_id, book, chapter);

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY, ref TEXT, book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER,
    title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS notes_ref ON notes (book, chapter, verse);
  CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY, ref TEXT NOT NULL, vid INTEGER NOT NULL, translation_id TEXT, color TEXT NOT NULL,
    updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS highlights_unique ON highlights (ref, IFNULL(translation_id, '*'));
  CREATE TABLE IF NOT EXISTS underlines (
    id TEXT PRIMARY KEY, ref TEXT NOT NULL, vid INTEGER NOT NULL, translation_id TEXT,
    updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS underlines_unique ON underlines (ref, IFNULL(translation_id, '*'));
  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('verse','chapter')), ref TEXT NOT NULL, vid INTEGER NOT NULL,
    favourite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS bookmarks_unique ON bookmarks (kind, ref);
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS collection_items (
    collection_id TEXT NOT NULL, ref TEXT NOT NULL, vid INTEGER NOT NULL, added_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (collection_id, ref)
  );
  CREATE TABLE IF NOT EXISTS reading_history (
    id TEXT PRIMARY KEY, book TEXT NOT NULL, chapter INTEGER NOT NULL, translation_mode TEXT NOT NULL,
    read_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS reading_history_time ON reading_history (read_at DESC);
  CREATE TABLE IF NOT EXISTS prayers (
    id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', answered INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS daily_verse_log (day TEXT PRIMARY KEY, ref TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sync_queue (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, row_id TEXT NOT NULL, queued_at TEXT NOT NULL
  );
  `,
  // v2: personal calendar events (church programmes, prayer meetings, birthdays…)
  `
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, day TEXT NOT NULL, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS events_day ON events (day);
  `,
  // v3: Bible Guide (AI) conversation, kept on the device
  `
  CREATE TABLE IF NOT EXISTS guide_messages (
    id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL
  );
  `,
];

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let v = row?.user_version ?? 0;
  for (; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export const DB_NAME = "vachanam.db";
