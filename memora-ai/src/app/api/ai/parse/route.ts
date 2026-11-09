import { z } from "zod";
import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { jsonCompletion } from "@/lib/ai";
import { MEMORY_CATEGORIES } from "@/lib/utils";

const Body = z.object({ text: z.string().trim().min(1).max(4000), timezone: z.string().max(64).default("Asia/Kolkata"), now: z.string().max(40).optional() });
const Out = z.object({
  kind: z.enum(["memory", "task", "reminder"]).catch("memory"),
  title: z.string().max(200).catch(""),
  content: z.string().max(4000).catch(""),
  category: z.enum(MEMORY_CATEGORIES).catch("General Notes"),
  priority: z.enum(["low", "medium", "high"]).catch("medium"),
  subject: z.enum(["mathematics", "physics", "chemistry", ""]).catch(""),
  due_at: z.string().nullable().catch(null),
  remind_at: z.string().nullable().catch(null),
});

/** Turns a spoken / typed sentence into a suggested memory, task or reminder. Nothing is saved here. */
export const POST = route("parse", Body, async (_ctx, body) => {
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: body.timezone, dateStyle: "full", timeStyle: "short" }).format(body.now ? new Date(body.now) : new Date());
  const raw = await jsonCompletion(
    `You convert a student's sentence (English or Telugu) into ONE structured item for their review. Today is ${now} in timezone ${body.timezone}.
Return JSON: {"kind":"memory"|"task"|"reminder","title":short title (in the user's language),"content":the full information, faithful to what they said,"category":one of ${JSON.stringify(MEMORY_CATEGORIES)},"priority":"low"|"medium"|"high","subject":"mathematics"|"physics"|"chemistry"|"","due_at":ISO 8601 with offset or null,"remind_at":ISO 8601 with offset or null}.
Rules: "remember/save/note" facts → memory. Something to do (homework, assignment, study) → task with due_at if a date is said. "Remind me…" or an event at a time (test, exam, class) → reminder with due_at = the event time; remind_at = the evening before at 19:00 if a day is given. Resolve relative dates ("next Monday", "Friday") against today. If no time is given use 09:00 local. Never invent details that were not said.`,
    body.text,
    { temperature: 0.1, maxTokens: 600 },
  );
  const out = Out.parse(raw);
  const iso = (s: string | null) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null);
  return NextResponse.json({ ...out, title: out.title || body.text.slice(0, 80), content: out.content || body.text, due_at: iso(out.due_at), remind_at: iso(out.remind_at) });
}, 30);
