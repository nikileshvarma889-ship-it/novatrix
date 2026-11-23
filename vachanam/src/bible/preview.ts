import { useEffect, useState } from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import { useBibleDb } from "./BibleProvider";
import { EN, TE } from "./repo";

/** Loads Telugu + English text for a list of verse ids (for previews in lists). */
export async function loadTexts(db: SQLiteDatabase, vids: number[]): Promise<Record<number, { te?: string; en?: string }>> {
  const out: Record<number, { te?: string; en?: string }> = {};
  for (let i = 0; i < vids.length; i += 400) {
    const chunk = vids.slice(i, i + 400);
    const rows = await db.getAllAsync<{ vid: number; translation_id: string; text: string }>(
      `SELECT v.vid, t.language AS translation_id, v.text FROM verses v JOIN translations t ON t.id = v.translation_id WHERE t.language IN (?, ?) AND v.vid IN (${chunk.map(() => "?").join(",")})`, [TE, EN, ...chunk]);
    for (const r of rows) (out[r.vid] ??= {})[r.translation_id === TE ? "te" : "en"] = r.text;
  }
  return out;
}
export function useVerseTexts(vids: number[] | null) {
  const { db } = useBibleDb();
  const [texts, setTexts] = useState<Record<number, { te?: string; en?: string }>>({});
  const key = vids?.join(",") ?? "";
  useEffect(() => { if (db && vids?.length) loadTexts(db, vids).then(setTexts).catch(() => {}); }, [db, key]);
  return texts;
}
