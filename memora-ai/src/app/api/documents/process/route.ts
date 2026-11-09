import { z } from "zod";
import { NextResponse } from "next/server";
import { route, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ documentId: z.string().uuid() });

function chunk(text: string, size = 1400, overlap = 150) {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(clean.length, i + size);
    if (end < clean.length) {
      const brk = Math.max(clean.lastIndexOf("\n\n", end), clean.lastIndexOf(". ", end));
      if (brk > i + size * 0.5) end = brk + 1;
    }
    out.push(clean.slice(i, end).trim());
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return out.filter(Boolean);
}

/** Extracts text (per page for PDFs) from an uploaded file in the user's private storage, and indexes it for search & Q&A. */
export const POST = route("doc-process", Body, async ({ supabase, user }, b) => {
  const { data: doc } = await supabase.from("documents").select("*").eq("id", b.documentId).maybeSingle();
  if (!doc) return jsonError("Document not found.", 404);
  if (!doc.file_path.startsWith(user.id + "/")) return jsonError("Not allowed.", 403);
  await supabase.from("documents").update({ status: "processing", error: null }).eq("id", doc.id);
  const fail = async (msg: string) => {
    await supabase.from("documents").update({ status: "failed", error: msg }).eq("id", doc.id);
    return jsonError(msg, 422);
  };
  const { data: file, error } = await supabase.storage.from("user-files").download(doc.file_path);
  if (error || !file) return fail("Could not read the uploaded file.");

  let pages: { page: number | null; text: string }[] = [];
  try {
    if (doc.mime_type === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: false });
      pages = (text as string[]).map((t, i) => ({ page: i + 1, text: t }));
    } else if (doc.mime_type.startsWith("text/")) {
      pages = [{ page: null, text: await file.text() }];
    } else {
      return fail("This file type can be stored but not read by the AI yet. Upload a PDF or TXT file for AI features.");
    }
  } catch {
    return fail("The file could not be read. It may be damaged or password-protected.");
  }
  const total = pages.reduce((n, p) => n + p.text.trim().length, 0);
  if (total < 20) return fail("No text was found. This looks like a scanned PDF (images only) — AI features need a PDF with selectable text.");

  await supabase.from("document_chunks").delete().eq("document_id", doc.id);
  const rows: { document_id: string; page: number | null; chunk_index: number; content: string }[] = [];
  let idx = 0;
  for (const p of pages) for (const c of chunk(p.text)) rows.push({ document_id: doc.id, page: p.page, chunk_index: idx++, content: c });
  for (let i = 0; i < rows.length; i += 200) {
    const { error: e } = await supabase.from("document_chunks").insert(rows.slice(i, i + 200));
    if (e) return fail("Indexing failed: " + e.message);
  }
  await supabase.from("documents").update({ status: "ready", page_count: pages[0]?.page ? pages.length : null, error: null }).eq("id", doc.id);
  return NextResponse.json({ ok: true, chunks: rows.length, pages: pages.length });
}, 10);
