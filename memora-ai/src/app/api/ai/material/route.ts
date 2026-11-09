import { z } from "zod";
import { route, jsonError } from "@/lib/api";
import { FORMAT_RULES, LANG_INSTRUCTION, streamText } from "@/lib/ai";
import { loadSource, relevantPassages } from "@/lib/sources";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  kind: z.enum(["note", "document"]),
  id: z.string().uuid(),
  action: z.enum(["summary", "key_points", "revision_notes", "questions", "ask"]),
  question: z.string().trim().max(2000).optional(),
  language: z.enum(["en", "te", "en_te"]).default("en"),
});

const TASKS = {
  summary: "Write a clear, well-structured summary (headings + bullets).",
  key_points: "Extract the most important points as a numbered list. Include key definitions and formulas exactly as written.",
  revision_notes: "Turn it into compact revision notes: headings, bullet points, formulas in LaTeX, and a short 'Remember' box at the end.",
  questions: "Write 8 practice questions (mix of short-answer and numerical where the material allows) with brief answers at the end. Label the section 'AI-generated practice questions'.",
  ask: "Answer the student's question.",
} as const;

/** Summaries, key points, revision notes, practice questions and Q&A grounded strictly in the user's own note or document. */
export const POST = route("material", Body, async ({ supabase }, b) => {
  if (b.action === "ask" && !b.question) return jsonError("Please type a question.");
  let material: string, title: string, pages = false;
  if (b.kind === "document" && b.action === "ask") {
    const { data: doc } = await supabase.from("documents").select("title,status").eq("id", b.id).maybeSingle();
    if (!doc) return jsonError("Document not found.", 404);
    if (doc.status !== "ready") return jsonError("This document is still being processed or failed to process.", 409);
    material = await relevantPassages(supabase, b.id, b.question!, 8);
    title = doc.title; pages = true;
  } else {
    const src = await loadSource(supabase, b.kind, b.id);
    if (!src) return jsonError(b.kind === "document" ? "Document not found or not ready yet." : "Note not found.", 404);
    if (!src.text.trim()) return jsonError("There is no text to work with. (Scanned PDFs without a text layer can't be read yet.)", 422);
    material = src.text; title = src.title; pages = src.pages;
  }

  const system = `You help a student study their OWN material titled "${title}". ${LANG_INSTRUCTION[b.language]}
${FORMAT_RULES}
GROUNDING RULES:
- Use ONLY the material below. Do not add facts that are not in it. If the material doesn't contain the answer, say exactly: "This isn't covered in the uploaded material." You may then add a clearly labelled "General knowledge (not from your material):" paragraph if helpful.
- ${pages ? "Cite page numbers for every claim like (p. 3), using the [Page N] markers." : "Quote short phrases from the note when useful."}
- Never invent page numbers, quotes or content.
Task: ${TASKS[b.action]}

MATERIAL:
"""
${material}
"""`;
  const stream = await streamText([{ role: "system", content: system }, { role: "user", content: b.action === "ask" ? b.question! : TASKS[b.action] }], { temperature: 0.2, maxTokens: 2500 });
  const enc = new TextEncoder();
  let full = "";
  return new Response(new ReadableStream({
    async start(c) {
      try {
        for await (const chunk of stream) { const t = chunk.choices[0]?.delta?.content; if (t) { full += t; c.enqueue(enc.encode(t)); } }
      } catch { c.enqueue(enc.encode("\n\n_The answer was interrupted. Please try again._")); }
      if (b.kind === "document" && b.action === "summary" && full) await supabase.from("documents").update({ summary: full }).eq("id", b.id);
      c.close();
    },
  }), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}, 20);
