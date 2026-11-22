import { BOOKS } from "../data/books";

/** Finds Bible citations like "John 3:16", "Psalm 23:1-4", "1 Corinthians 13" in free text,
 *  so AI answers can link straight into the reader. Only valid book/chapter numbers become links. */
export type Seg = { kind: "text"; text: string } | { kind: "ref"; text: string; book: string; chapter: number; verse?: number };

const ALIASES: Record<string, string> = { Psalm: "PSA", Psalms: "PSA", "Song of Solomon": "SNG", "Song of Songs": "SNG", Revelations: "REV" };
const NAME_TO_CODE: Record<string, string> = { ...Object.fromEntries(BOOKS.map((b) => [b.name, b.code])), ...ALIASES };
const names = Object.keys(NAME_TO_CODE).sort((a, b) => b.length - a.length).map((n) => n.replace(/ /g, "\\s+"));
const RE = new RegExp(`\\b(${names.join("|")})\\s+(\\d{1,3})(?::(\\d{1,3})(?:\\s*[-–]\\s*\\d{1,3})?)?`, "g");

export function splitRefs(text: string): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const code = NAME_TO_CODE[m[1].replace(/\s+/g, " ")];
    const chapter = Number(m[2]);
    const book = BOOKS.find((b) => b.code === code);
    if (!book || chapter < 1 || chapter > book.chapters) continue;
    if (m.index! > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    out.push({ kind: "ref", text: m[0], book: code, chapter, verse: m[3] ? Number(m[3]) : undefined });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
