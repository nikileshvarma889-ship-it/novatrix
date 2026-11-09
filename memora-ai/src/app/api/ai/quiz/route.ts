import { z } from "zod";
import { NextResponse } from "next/server";
import { route, jsonError } from "@/lib/api";
import { jsonCompletion } from "@/lib/ai";
import { CHAPTERS } from "@/lib/syllabus";
import { loadSource } from "@/lib/sources";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  subject: z.enum(["mathematics", "physics", "chemistry"]),
  chapterId: z.string().max(20).nullable().optional(),
  level: z.enum(["inter1", "inter2", "eapcet"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().int().min(3).max(30),
  minutesPerQuestion: z.number().min(0.5).max(5).default(1.5),
  sourceKind: z.enum(["note", "document"]).optional(),
  sourceId: z.string().uuid().optional(),
});
const Q = z.object({
  question: z.string().min(3).max(3000),
  options: z.array(z.string().min(1).max(800)).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().min(1).max(4000),
  topic: z.string().max(120).catch("General"),
});

/** Generates an AI practice quiz and stores it for the user. Every quiz is labelled AI-generated. */
export const POST = route("quiz", Body, async ({ supabase }, b) => {
  const ch = b.chapterId ? CHAPTERS.find((c) => c.id === b.chapterId && c.subject === b.subject) : null;
  if (b.chapterId && !ch) return jsonError("Unknown chapter.");
  const chapters = ch ? [ch] : CHAPTERS.filter((c) => c.subject === b.subject && (b.level === "eapcet" || c.year === (b.level === "inter1" ? 1 : 2)));
  let material = "";
  if (b.sourceKind && b.sourceId) {
    const src = await loadSource(supabase, b.sourceKind, b.sourceId, 25000);
    if (!src?.text.trim()) return jsonError("That note/document has no readable text.", 422);
    material = src.text;
  }
  const levelText = { inter1: "Intermediate 1st Year board level", inter2: "Intermediate 2nd Year board level", eapcet: "EAPCET entrance level (conceptual + quick numerical)" }[b.level];
  const out = await jsonCompletion<{ questions: unknown[] }>(
    `You write accurate multiple-choice practice questions for ${levelText}. Subject: ${b.subject}. Difficulty: ${b.difficulty}.
Chapters to cover: ${chapters.map((c) => c.title).join("; ")}.
${material ? "Base every question ONLY on the student's material provided." : ""}
Rules: exactly 4 options per question; exactly one correct option (answer = its 0-based index); distractors must be plausible but clearly wrong; vary the position of the correct answer.
Use LaTeX in $...$ for maths, units and chemical formulas — every LaTeX command (\\frac, \\text, \\sqrt…) must be inside a matching pair of $ signs, in questions AND options. Numerical answers must be computed carefully — solve each one yourself before writing the options.
The explanation shows the reasoning / calculation briefly. "topic" = the chapter or sub-topic tested.
These are original AI-generated practice questions: never claim they are from official or previous-year papers.
Return {"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","topic":"..."}]} with ${b.count} questions.`,
    material ? `STUDENT MATERIAL:\n"""\n${material}\n"""` : `Generate ${b.count} questions.`,
    { temperature: 0.4, maxTokens: Math.min(12000, 450 * b.count + 500) },
  );
  const questions = (Array.isArray(out.questions) ? out.questions : []).map((q) => Q.safeParse(q)).filter((r) => r.success).map((r) => r.data!);
  if (questions.length < Math.min(3, b.count)) return jsonError("The AI couldn't produce a valid quiz. Please try again.", 422);
  const title = `${ch ? ch.title : b.subject[0].toUpperCase() + b.subject.slice(1)} · ${b.difficulty} practice`;
  const { data, error } = await supabase.from("quizzes").insert({
    title, subject: b.subject, chapter_id: ch?.id ?? null, level: b.level, difficulty: b.difficulty,
    time_limit_seconds: Math.round(Math.max(60, questions.length * b.minutesPerQuestion * 60)), ai_generated: true, questions,
  }).select("id").single();
  if (error || !data) return jsonError("The quiz was generated but could not be saved: " + (error?.message ?? ""), 500);
  return NextResponse.json({ id: data.id, count: questions.length });
}, 10);
