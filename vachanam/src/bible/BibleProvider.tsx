import React, { createContext, useContext, useEffect, useState } from "react";
import { importDatabaseFromAssetAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

/** The Bible text ships inside the app as a read-only SQLite database (assets/bible/bible.db),
 *  separate from the user's own data. Bump the file name when the bundled text changes. */
export const BIBLE_DB = "bible-v1.db";

type Ctx = { db: SQLiteDatabase | null; error: string | null; refresh: () => void };
const BibleCtx = createContext<Ctx>({ db: null, error: null, refresh: () => {} });

const ASSET = require("../../assets/bible/bible.db");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Opens the bundled Bible, importing it only on first launch (or if the copy is missing or incomplete).
 *  Retries briefly because a just-closed previous instance can still hold the file for a moment. */
async function openBible(): Promise<SQLiteDatabase> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      try {
        const db = await openDatabaseAsync(BIBLE_DB);
        const ok = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'").catch(() => null);
        if (ok) return db;
        await db.closeAsync();
      } catch {}
      await importDatabaseFromAssetAsync(BIBLE_DB, { assetId: ASSET, forceOverwrite: true });
      return await openDatabaseAsync(BIBLE_DB);
    } catch (e) {
      lastError = e;
      await sleep(Math.min(3000, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

export function BibleProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ db: SQLiteDatabase | null; error: string | null }>({ db: null, error: null });
  const [rev, setRev] = useState(0);
  useEffect(() => {
    let live = true;
    openBible().then((db) => live && setState({ db, error: null })).catch((e) => live && setState({ db: null, error: String(e?.message ?? e) }));
    return () => { live = false; };
  }, [rev]);
  /** After the Bible text changes (e.g. an import), reopen so every screen reloads. */
  const refresh = React.useCallback(() => { setState({ db: null, error: null }); setRev((r) => r + 1); }, []);
  return <BibleCtx.Provider value={{ ...state, refresh }}>{children}</BibleCtx.Provider>;
}
export const useBibleDb = () => useContext(BibleCtx);
