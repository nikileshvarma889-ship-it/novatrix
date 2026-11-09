import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Loaded = { title: string; text: string; pages: boolean; documentId?: string };

/** Loads the user's own note / document / video notes as text with page markers (RLS-restricted). */
export async function loadSource(sb: SupabaseClient, kind: "note" | "document" | "video", id: string, maxChars = 60000): Promise<Loaded | null> {
  if (kind === "note") {
    const { data } = await sb.from("notes").select("title,content").eq("id", id).maybeSingle();
    return data ? { title: data.title, text: data.content.slice(0, maxChars), pages: false } : null;
  }
  if (kind === "video") {
    const [{ data: v }, { data: notes }] = await Promise.all([
      sb.from("videos").select("title,channel_title").eq("video_id", id).maybeSingle(),
      sb.from("video_notes").select("timestamp_seconds,content").eq("video_id", id).order("timestamp_seconds", { ascending: true, nullsFirst: true }),
    ]);
    if (!notes?.length) return null;
    const fmt = (s: number | null) => (s == null ? "" : `[${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}] `);
    return { title: `My notes on "${v?.title ?? id}"`, text: notes.map((n) => fmt(n.timestamp_seconds) + n.content).join("\n").slice(0, maxChars), pages: false };
  }
  const { data: doc } = await sb.from("documents").select("id,title,status").eq("id", id).maybeSingle();
  if (!doc || doc.status !== "ready") return null;
  const { data: chunks } = await sb.from("document_chunks").select("page,content").eq("document_id", id).order("chunk_index").limit(400);
  let text = "";
  let lastPage: number | null = -1;
  for (const c of chunks ?? []) {
    if (c.page !== lastPage && c.page != null) { text += `\n\n[Page ${c.page}]\n`; lastPage = c.page; }
    text += c.content + "\n";
    if (text.length > maxChars) { text = text.slice(0, maxChars) + "\n[…document truncated…]"; break; }
  }
  return { title: doc.title, text, pages: true, documentId: doc.id };
}

/** The most relevant passages of a document for a question, with page numbers. */
export async function relevantPassages(sb: SupabaseClient, documentId: string, question: string, k = 6) {
  const { data } = await sb.rpc("search_document_chunks", { doc: documentId, q: question, lim: k });
  let rows = (data ?? []) as { page: number | null; chunk_index: number; content: string }[];
  if (!rows.length) {
    const { data: first } = await sb.from("document_chunks").select("page,chunk_index,content").eq("document_id", documentId).order("chunk_index").limit(4);
    rows = first ?? [];
  }
  return rows.sort((a, b) => a.chunk_index - b.chunk_index).map((r) => `[Page ${r.page ?? "?"}]\n${r.content}`).join("\n\n---\n\n");
}
