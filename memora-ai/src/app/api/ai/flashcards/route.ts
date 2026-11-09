import { z } from "zod";
import { NextResponse } from "next/server";
import { route, jsonError } from "@/lib/api";
import { jsonCompletion } from "@/lib/ai";
import { loadSource } from "@/lib/sources";
import { CHAPTERS } from "@/lib/syllabus";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  source: z.enum(["text", "note", "document", "video", "chapter"]),
  id: z.string().max(64).optional(),
  text: z.string().max(20000).optional(),
  chapterId: z.string().max(20).optional(),
  subject: z.enum(["mathematics", "physics", "chemistry"]).optional(),
  count: z.number().int().min(3).max(25).default(10),
  language: z.enum(["en", "te", "en_te"]).default("en"),
});
const Card = z.object({ front: z.string().min(1).max(2000), back: z.string().min(1).max(4000), difficulty: z.enum(["easy", "medium", "hard"]).catch("medium") });

/** Generates flashcards for review. Returned to the client for preview; the user decides what to save. */
export const POST = route("flashcards", Body, async ({ supabase }, b) => {
  let material = "", origin = "";
  const ch = b.chapterId ? CHAPTERS.find((c) => c.id === b.chapterId) : null;
  if (b.source === "text") {
    if (!b.text?.trim()) return jsonError("Please paste some text.");
    material = b.text; origin = "the student's pasted text";
  } else if (b.source === "chapter") {
    if (!ch) return jsonError("Please choose a chapter.");
    origin = `standard Intermediate syllabus knowledge for the chapter "${ch.title}" (${ch.subject})`;
  } else {
    if (!b.id) return jsonError("Missing source.");
    const src = await loadSource(supabase, b.source, b.id, 30000);
    if (!src || !src.text.trim()) return jsonError(b.source === "video" ? "Add some notes to this video first — flashcards are made from your own notes." : "Source not found or has no readable text.", 404);
    material = src.text; origin = `the student's ${b.source} "${src.title}"`;
  }
  const lang = { en: "English", te: "Telugu (keep formulas and symbols in standard notation)", en_te: "English, with a short Telugu line on the back" }[b.language];
  const out = await jsonCompletion<{ cards: unknown[] }>(
    `Create ${b.count} high-quality study flashcards from ${origin}. Language: ${lang}.
Each card tests ONE idea: definitions, formulas (LaTeX in $...$), laws, units, reactions, key facts or short numerical concepts. Fronts are questions/prompts; backs are concise, correct answers.
${material ? "Use ONLY facts present in the material; never invent." : "Use only well-established textbook facts."}
Return {"cards":[{"front":"...","back":"...","difficulty":"easy"|"medium"|"hard"}]}.`,
    material ? `MATERIAL:\n"""\n${material}\n"""` : `Chapter: ${ch?.title}`,
    { temperature: 0.3, maxTokens: 3500 },
  );
  const cards = (Array.isArray(out.cards) ? out.cards : []).map((c) => Card.safeParse(c)).filter((r) => r.success).map((r) => r.data!).slice(0, b.count);
  if (!cards.length) return jsonError("The AI couldn't produce flashcards from this source. Try again or use different material.", 422);
  return NextResponse.json({ cards, fromMaterial: Boolean(material) });
}, 15);
