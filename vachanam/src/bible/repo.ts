import type { SQLiteDatabase } from "expo-sqlite";

export const TE = "tel_irv";
export const EN = "eng_bsb";
export type VerseRow = { vid: number; verse: number; vto: number | null; para: number; poetry: number; text: string };
export type Heading = { before_verse: number; level: number; text: string };
export type Chapter = { te: VerseRow[]; en: VerseRow[]; headTe: Heading[]; headEn: Heading[] };
export type Translation = { id: string; language: string; name: string; short_name: string; copyright: string; license: string; source_url: string };
export type BookNames = Record<string, Record<string, { name: string; short_name: string }>>;

export async function loadChapter(db: SQLiteDatabase, book: string, chapter: number): Promise<Chapter> {
  const v = (t: string) => db.getAllAsync<VerseRow>("SELECT vid, verse, vto, para, poetry, text FROM verses WHERE translation_id = ? AND book = ? AND chapter = ? ORDER BY verse", [t, book, chapter]);
  const h = (t: string) => db.getAllAsync<Heading>("SELECT before_verse, level, text FROM headings WHERE translation_id = ? AND book = ? AND chapter = ? ORDER BY rowid", [t, book, chapter]);
  const [te, en, headTe, headEn] = await Promise.all([v(TE), v(EN), h(TE), h(EN)]);
  return { te, en, headTe, headEn };
}

export async function loadBookNames(db: SQLiteDatabase): Promise<BookNames> {
  const rows = await db.getAllAsync<{ translation_id: string; book: string; name: string; short_name: string }>("SELECT translation_id, book, name, short_name FROM book_names");
  const out: BookNames = {};
  for (const r of rows) (out[r.translation_id] ??= {})[r.book] = { name: r.name, short_name: r.short_name };
  return out;
}

export const loadTranslations = (db: SQLiteDatabase) => db.getAllAsync<Translation>("SELECT * FROM translations ORDER BY language DESC");

export async function loadVerse(db: SQLiteDatabase, vid: number) {
  const rows = await db.getAllAsync<{ translation_id: string; text: string }>("SELECT translation_id, text FROM verses WHERE vid = ? AND translation_id IN (?, ?)", [vid, TE, EN]);
  return { te: rows.find((r) => r.translation_id === TE)?.text ?? null, en: rows.find((r) => r.translation_id === EN)?.text ?? null };
}

/** Pairs Telugu and English verses for parallel reading. A Telugu range (e.g. 1-2) is matched
 *  with every English verse it covers, so the two columns never drift apart. */
export type ParallelRow = { key: number; label: string; te?: VerseRow; en: VerseRow[]; para: boolean };
export function alignChapter(te: VerseRow[], en: VerseRow[]): ParallelRow[] {
  const rows: ParallelRow[] = [];
  const enBy = new Map(en.map((v) => [v.verse, v]));
  const used = new Set<number>();
  for (const t of te) {
    const last = t.vto ?? t.verse;
    const ens: VerseRow[] = [];
    for (let n = t.verse; n <= last; n++) { const e = enBy.get(n); if (e) { ens.push(e); used.add(n); } }
    rows.push({ key: t.verse, label: t.vto ? `${t.verse}-${t.vto}` : String(t.verse), te: t, en: ens, para: !!t.para });
  }
  for (const e of en) if (!used.has(e.verse)) rows.push({ key: e.verse, label: String(e.verse), en: [e], para: !!e.para });
  return rows.sort((a, b) => a.key - b.key);
}
