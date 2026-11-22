import { BOOK_BY_CODE, BOOKS } from "../data/books";

/** Next / previous chapter across book boundaries (Genesis 50 -> Exodus 1, Revelation 22 -> none). */
export function neighbour(book: string, chapter: number, dir: 1 | -1): { book: string; chapter: number } | null {
  const b = BOOK_BY_CODE[book];
  if (!b) return null;
  if (dir === 1 && chapter < b.chapters) return { book, chapter: chapter + 1 };
  if (dir === -1 && chapter > 1) return { book, chapter: chapter - 1 };
  const nb = BOOKS[b.order - 1 + dir];
  if (!nb) return null;
  return { book: nb.code, chapter: dir === 1 ? 1 : nb.chapters };
}
