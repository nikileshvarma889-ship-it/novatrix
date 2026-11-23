import React, { createContext, useContext, useEffect, useState } from "react";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

/** Web build: browsers (and claude.ai pages) can't be handed a .db file, so the Bible ships as JSON
 *  (public/bible/, made by tools/export-bible-json.mjs) and is written into the browser's SQLite once. */
export const BIBLE_DB = "bible-v3.db";
type Ctx = { db: SQLiteDatabase | null; error: string | null };
const BibleCtx = createContext<Ctx>({ db: null, error: null });
const base = () => ((globalThis as { __VB?: string }).__VB ?? "") + "/bible/";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(name: string): Promise<T> {
  const res = await fetch(base() + name);
  if (!res.ok) throw new Error(`Couldn't download ${name} (${res.status})`);
  return res.json() as Promise<T>;
}

async function insertRows(db: SQLiteDatabase, table: string, rows: unknown[][]) {
  if (!rows.length) return;
  const cols = rows[0].length, per = Math.max(1, Math.floor(900 / cols));
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    await db.runAsync(`INSERT INTO ${table} VALUES ${chunk.map(() => `(${Array(cols).fill("?").join(",")})`).join(",")}`, chunk.flat() as (string | number | null)[]);
  }
}

async function openBible(): Promise<SQLiteDatabase> {
  let last: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const db = await openDatabaseAsync(BIBLE_DB);
      const ok = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'complete'").catch(() => null);
      if (ok) return db;
      const meta = await fetchJson<{ schema: string[]; tables: Record<string, unknown[][]> }>("meta.json");
      const ids = meta.tables.translations.map((t) => String(t[0]));
      const verses = await Promise.all(ids.map((id) => fetchJson<unknown[][]>(`verses-${id}.json`)));
      await db.withTransactionAsync(async () => {
        for (const t of ["verses", "headings", "book_names", "translations", "meta"]) await db.execAsync(`DROP TABLE IF EXISTS ${t}`);
        for (const sql of meta.schema) await db.execAsync(sql);
        for (const [t, rows] of Object.entries(meta.tables)) await insertRows(db, t, rows);
        for (let i = 0; i < ids.length; i++) await insertRows(db, "verses", verses[i].map((r) => [ids[i], ...r]));
        await db.runAsync("INSERT INTO meta VALUES ('complete', '1')");
      });
      return db;
    } catch (e) {
      last = e;
      await sleep(Math.min(3000, 400 * (attempt + 1)));
    }
  }
  throw last;
}

export function BibleProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Ctx>({ db: null, error: null });
  useEffect(() => {
    let live = true;
    openBible().then((db) => live && setState({ db, error: null })).catch((e) => live && setState({ db: null, error: String(e?.message ?? e) }));
    return () => { live = false; };
  }, []);
  return <BibleCtx.Provider value={state}>{children}</BibleCtx.Provider>;
}
export const useBibleDb = () => useContext(BibleCtx);
