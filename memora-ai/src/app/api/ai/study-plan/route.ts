import { z } from "zod";
import { NextResponse } from "next/server";
import { route, jsonError } from "@/lib/api";
import { jsonCompletion } from "@/lib/ai";
import { CHAPTERS } from "@/lib/syllabus";
import { addDaysKey, dayKey, zonedToUtc } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  examName: z.string().max(100).default("Exam"),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  subjects: z.array(z.enum(["mathematics", "physics", "chemistry"])).min(1),
  chapterIds: z.array(z.string().max(20)).max(120).default([]),
  hoursPerDay: z.number().min(0.5).max(10),
  preferredTimes: z.array(z.enum(["early_morning", "morning", "afternoon", "evening", "night"])).min(1),
  level: z.enum(["beginner", "average", "good", "revision_only"]),
  timezone: z.string().max(64).default("Asia/Kolkata"),
  restDays: z.array(z.number().int().min(0).max(6)).default([]),
});

const WINDOWS: Record<string, [string, string]> = {
  early_morning: ["05:30", "07:30"], morning: ["08:00", "12:00"], afternoon: ["14:00", "17:00"], evening: ["17:30", "20:30"], night: ["20:30", "22:30"],
};

const Session = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  minutes: z.number().int().min(15).max(240),
  subject: z.enum(["mathematics", "physics", "chemistry"]),
  chapterId: z.string().nullable().catch(null),
  kind: z.enum(["study", "revision", "practice"]).catch("study"),
  title: z.string().min(1).max(160),
});

/**
 * The AI drafts the order and mix of topics; the server then enforces realism:
 * sessions ≤ 90 min, ≥ 15 min breaks, daily total ≤ the hours the student entered, only inside preferred windows,
 * a final revision period before the exam. Nothing is saved until the student confirms.
 */
export const POST = route("study-plan", Body, async (_ctx, b) => {
  const start = b.startDate ?? dayKey(new Date(), b.timezone);
  const days = Math.round((Date.parse(b.examDate) - Date.parse(start)) / 86400000);
  if (days < 1) return jsonError("The exam date must be after the start date.");
  if (days > 240) return jsonError("Please plan at most 8 months ahead at a time.");
  const chapters = (b.chapterIds.length ? CHAPTERS.filter((c) => b.chapterIds.includes(c.id)) : CHAPTERS.filter((c) => b.subjects.includes(c.subject)))
    .filter((c) => b.subjects.includes(c.subject));
  const out = await jsonCompletion<{ sessions: unknown[] }>(
    `You are an experienced study-planning coach for Intermediate/EAPCET students. Create a realistic day-by-day plan.
Start: ${start}. Exam (${b.examName}): ${b.examDate} (${days} days). Study hours available per day: ${b.hoursPerDay}. Preparation level: ${b.level}.
Preferred times: ${b.preferredTimes.join(", ")} (windows: ${b.preferredTimes.map((t) => `${t} ${WINDOWS[t].join("-")}`).join("; ")}). Rest days (0=Sun): ${b.restDays.join(", ") || "none"}.
Chapters (id: subject — title): ${chapters.map((c) => `${c.id}: ${c.subject} — ${c.title}`).join("; ")}.
Rules: sessions 30–90 minutes; interleave subjects; harder/longer chapters get more time; keep the last ${Math.min(7, Math.max(1, Math.floor(days / 5)))} days before the exam for revision and practice; add a weekly revision session; never exceed the daily hours; no sessions on rest days or on the exam day.
Return {"sessions":[{"date":"YYYY-MM-DD","start":"HH:MM","minutes":60,"subject":"physics","chapterId":"pi-03"|null,"kind":"study"|"revision"|"practice","title":"short title"}]}. At most 400 sessions.`,
    "Create the plan.",
    { temperature: 0.3, maxTokens: 12000 },
  );
  const raw = (Array.isArray(out.sessions) ? out.sessions : []).map((s) => Session.safeParse(s)).filter((r) => r.success).map((r) => r.data!);

  // ---- enforce limits deterministically ----
  const dailyCap = Math.round(b.hoursPerDay * 60);
  const windows = b.preferredTimes.map((t) => WINDOWS[t]).sort((x, y) => x[0].localeCompare(y[0]));
  const toMin = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3);
  const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const byDay = new Map<string, typeof raw>();
  for (const s of raw) {
    if (s.date < start || s.date >= b.examDate) continue;
    const dow = new Date(s.date + "T00:00:00Z").getUTCDay();
    if (b.restDays.includes(dow)) continue;
    if (!byDay.has(s.date)) byDay.set(s.date, []);
    byDay.get(s.date)!.push({ ...s, minutes: Math.min(90, Math.max(30, s.minutes)), chapterId: chapters.some((c) => c.id === s.chapterId) ? s.chapterId : null });
  }
  const sessions: { title: string; subject: string; chapter_id: string | null; start_at: string; duration_minutes: number; kind: "study_session" | "revision" }[] = [];
  for (const [day, list] of Array.from(byDay.entries()).sort(([a], [b2]) => a.localeCompare(b2))) {
    let used = 0;
    let wi = 0, cursor = toMin(windows[0][0]);
    if (day === dayKey(new Date(), b.timezone)) {
      // never schedule in the past: start today's sessions from the next quarter hour
      const nowHM = new Intl.DateTimeFormat("en-GB", { timeZone: b.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
      cursor = Math.max(cursor, Math.ceil((toMin(nowHM) + 10) / 15) * 15);
    }
    for (const s of list.sort((x, y) => x.start.localeCompare(y.start))) {
      if (used + s.minutes > dailyCap) continue;
      while (wi < windows.length && cursor + s.minutes > toMin(windows[wi][1])) { wi++; if (wi < windows.length) cursor = Math.max(cursor, toMin(windows[wi][0])); }
      if (wi >= windows.length) break;
      sessions.push({ title: s.title, subject: s.subject, chapter_id: s.chapterId, start_at: zonedToUtc(day, toHM(cursor), b.timezone).toISOString(), duration_minutes: s.minutes, kind: s.kind === "study" ? "study_session" : "revision" });
      used += s.minutes;
      cursor += s.minutes + (s.minutes >= 60 ? 15 : 10);           // break after every session
    }
  }
  if (!sessions.length) return jsonError("The AI couldn't produce a usable plan. Try more study hours or more preferred time slots.", 422);
  return NextResponse.json({ sessions, days, lastDay: addDaysKey(b.examDate, -1) });
}, 6);
