import { BOOK_BY_CODE } from "../data/books";

/** Stable verse reference helpers ("JHN.3.16" <-> numeric vid). */
export const makeRef = (book: string, chapter: number, verse?: number) => (verse ? `${book}.${chapter}.${verse}` : `${book}.${chapter}`);
export const makeVid = (book: string, chapter: number, verse = 0) => BOOK_BY_CODE[book].order * 1_000_000 + chapter * 1_000 + verse;
export function parseRef(ref: string): { book: string; chapter: number; verse?: number } | null {
  const m = /^([1-3A-Z]{3})\.(\d+)(?:\.(\d+))?$/.exec(ref);
  if (!m || !BOOK_BY_CODE[m[1]]) return null;
  return { book: m[1], chapter: Number(m[2]), verse: m[3] ? Number(m[3]) : undefined };
}
export const displayRef = (book: string, chapter: number, verse?: number) => `${BOOK_BY_CODE[book]?.name ?? book} ${chapter}${verse ? `:${verse}` : ""}`;
