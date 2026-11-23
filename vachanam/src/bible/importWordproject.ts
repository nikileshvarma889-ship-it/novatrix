import JSZip from "jszip";
import type { SQLiteDatabase } from "expo-sqlite";
import { BOOKS } from "../data/books";

/**
 * Reads a wordproject.org Telugu Bible download (zip of tel/NN/C.html chapter pages) that the user chose
 * on their own device, and installs it into this device's local Bible database. Nothing is uploaded.
 */
export type Parsed = { names: Record<string, string>; verses: [number, string, number, number, string][]; problems: string[] };

const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const clean = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/¸/g, "").replace(/\s+/g, " ").trim();

/** Pure parser for one chapter page (exported for tests). */
export function parseChapter(html: string): { heading?: string; verses: { verse: number; text: string }[] } {
  const hs = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => clean(m[1]).replace(/^<>/, "").trim());
  const heading = hs.find((h) => h && !/word\s*project/i.test(h) && !/\d/.test(h));
  const at = html.indexOf('id="textBody"');
  let body = at >= 0 ? html.slice(at) : html;
  const end = body.search(/<\/div>/i);
  if (end > 0) body = body.slice(0, end);
  const parts = body.split(/<span class="verse" id="(\d+)">\s*\d+\s*<\/span>/i);
  const verses: { verse: number; text: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const t = clean(parts[i + 1] ?? "");
    if (!t) continue;
    const prev = verses.find((v) => v.verse === +parts[i]);
    if (prev) prev.text += " " + t;           // the source sometimes repeats a verse number: keep both parts
    else verses.push({ verse: +parts[i], text: t });
  }
  return { heading, verses };
}

export async function parseZip(data: ArrayBuffer, onProgress?: (done: number, total: number) => void): Promise<Parsed> {
  const zip = await JSZip.loadAsync(data);
  const files = new Map<string, JSZip.JSZipObject>();
  zip.forEach((p, f) => { const m = /(?:^|\/)(\d{2})\/(\d+)\.html?$/i.exec(p); if (m && !f.dir) files.set(`${+m[1]}/${+m[2]}`, f); });
  const total = BOOKS.reduce((n, b) => n + b.chapters, 0);
  const out: Parsed = { names: {}, verses: [], problems: [] };
  let done = 0;
  for (const b of BOOKS) {
    for (let ch = 1; ch <= b.chapters; ch++) {
      const f = files.get(`${b.order}/${ch}`);
      if (!f) { out.problems.push(`${b.name} ${ch} missing`); continue; }
      const { heading, verses } = parseChapter(await f.async("string"));
      if (!out.names[b.code] && heading) out.names[b.code] = heading;
      for (const v of verses) out.verses.push([b.order * 1_000_000 + ch * 1000 + v.verse, b.code, ch, v.verse, v.text]);
      if (++done % 50 === 0) onProgress?.(done, total);
    }
  }
  onProgress?.(total, total);
  if (out.verses.length < 30000) out.problems.unshift(`Only ${out.verses.length} verses found; this doesn't look like a complete wordproject Telugu Bible.`);
  return out;
}

const PERSONAL = { id: "tel_wp", name: "పవిత్ర బైబిల్ (wordproject.org)", short: "తెలుగు", license: "Personal copy",
  copyright: "Telugu Bible text from wordproject.org, imported by you from your own download. Stored only on this device." };

/** Replaces the installed Telugu translation with the imported one (English is left as it is). */
export async function installTelugu(db: SQLiteDatabase, p: Parsed) {
  await db.withTransactionAsync(async () => {
    const old = await db.getAllAsync<{ id: string }>("SELECT id FROM translations WHERE language = 'te'");
    for (const o of old) for (const t of ["verses", "headings", "book_names", "translations"]) await db.runAsync(`DELETE FROM ${t} WHERE ${t === "translations" ? "id" : "translation_id"} = ?`, [o.id]);
    await db.runAsync("INSERT INTO translations VALUES (?, 'te', ?, ?, ?, ?, ?)", [PERSONAL.id, PERSONAL.name, PERSONAL.short, PERSONAL.copyright, PERSONAL.license, "https://www.wordproject.org/bibles/te/index.htm"]);
    for (const b of BOOKS) await db.runAsync("INSERT INTO book_names VALUES (?, ?, ?, ?, NULL)", [PERSONAL.id, b.code, p.names[b.code] ?? b.name, p.names[b.code] ?? b.name]);
    for (let i = 0; i < p.verses.length; i += 100) {
      const chunk = p.verses.slice(i, i + 100);
      await db.runAsync(`INSERT INTO verses VALUES ${chunk.map(() => "(?, ?, ?, ?, ?, NULL, ?, 0, ?)").join(",")}`,
        chunk.flatMap(([vid, book, ch, v, text]) => [PERSONAL.id, vid, book, ch, v, v === 1 ? 1 : 0, text]));
    }
  });
}
