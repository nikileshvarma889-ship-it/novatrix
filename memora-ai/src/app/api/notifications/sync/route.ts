import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api";
import { dayKey, daysUntil, fmtDateTime } from "@/lib/dates";

export const runtime = "nodejs";

const Body = z.object({}).passthrough();
type N = { type: string; title: string; body: string; link: string; dedupe_key: string };

/**
 * Creates in-app notifications from the user's real data (reminders, deadlines, revision, flashcards, exam countdown).
 * Called when the app opens and periodically while it is open. Idempotent via dedupe keys.
 */
export const POST = route("notif-sync", Body, async ({ supabase, user }) => {
  const { data: profile } = await supabase.from("profiles").select("timezone,exam_name,exam_date,notify_in_app").eq("id", user.id).single();
  const tz = profile?.timezone || "Asia/Kolkata";
  const now = new Date();
  const today = dayKey(now, tz);
  const in24 = new Date(now.getTime() + 86400000).toISOString();
  const in30m = new Date(now.getTime() + 30 * 60000).toISOString();
  const out: N[] = [];

  const [reminders, dueSoon, overdue, sessions, cards, revisions] = await Promise.all([
    supabase.from("tasks").select("id,title,remind_at,due_at,kind").neq("status", "completed").not("remind_at", "is", null).lte("remind_at", now.toISOString()).gte("remind_at", new Date(now.getTime() - 7 * 86400000).toISOString()),
    supabase.from("tasks").select("id,title,due_at,kind").neq("status", "completed").in("kind", ["assignment", "task", "exam"]).gt("due_at", now.toISOString()).lte("due_at", in24),
    supabase.from("tasks").select("id,title,due_at,kind").neq("status", "completed").in("kind", ["assignment", "task"]).lt("due_at", now.toISOString()).gte("due_at", new Date(now.getTime() - 14 * 86400000).toISOString()),
    supabase.from("tasks").select("id,title,start_at").in("kind", ["study_session", "revision"]).neq("status", "completed").gt("start_at", now.toISOString()).lte("start_at", in30m),
    supabase.from("flashcards").select("id", { count: "exact", head: true }).lte("due_at", now.toISOString()),
    supabase.from("chapter_progress").select("chapter_id,revision_due,chapters(title)").not("revision_due", "is", null).lte("revision_due", today),
  ]);

  for (const t of reminders.data ?? []) out.push({ type: "reminder", title: `Reminder: ${t.title}`, body: t.due_at ? `Scheduled for ${fmtDateTime(t.due_at, tz)}` : "", link: "/planner", dedupe_key: `remind:${t.id}:${t.remind_at}` });
  for (const t of dueSoon.data ?? []) out.push({ type: t.kind === "exam" ? "exam" : "assignment", title: `Due soon: ${t.title}`, body: `Due ${fmtDateTime(t.due_at!, tz)}`, link: t.kind === "assignment" ? "/planner?tab=assignments" : "/planner", dedupe_key: `due:${t.id}:${t.due_at}` });
  for (const t of overdue.data ?? []) out.push({ type: "assignment", title: `Overdue: ${t.title}`, body: `Was due ${fmtDateTime(t.due_at!, tz)}`, link: t.kind === "assignment" ? "/planner?tab=assignments" : "/planner", dedupe_key: `overdue:${t.id}` });
  for (const s of sessions.data ?? []) out.push({ type: "study", title: `Study session soon: ${s.title}`, body: `Starts ${fmtDateTime(s.start_at!, tz)}`, link: "/planner", dedupe_key: `session:${s.id}:${s.start_at}` });
  if ((cards.count ?? 0) > 0) out.push({ type: "revision", title: `${cards.count} flashcard${cards.count === 1 ? "" : "s"} due for review`, body: "A short review today keeps them in long-term memory.", link: "/flashcards?review=1", dedupe_key: `cards:${today}` });
  for (const r of revisions.data ?? []) {
    const title = (r.chapters as unknown as { title: string } | null)?.title ?? r.chapter_id;
    out.push({ type: "revision", title: `Revise: ${title}`, body: `Scheduled for ${r.revision_due}`, link: "/study", dedupe_key: `rev:${r.chapter_id}:${r.revision_due}` });
  }
  if (profile?.exam_date) {
    const d = daysUntil(profile.exam_date, tz);
    if ([30, 14, 7, 3, 1, 0].includes(d)) out.push({ type: "exam", title: d === 0 ? `${profile.exam_name || "Exam"} is today — all the best!` : `${d} day${d === 1 ? "" : "s"} to ${profile.exam_name || "your exam"}`, body: d > 0 ? "Check your revision plan in the Study Planner." : "", link: "/planner", dedupe_key: `exam:${profile.exam_date}:${d}` });
  }

  let created: N[] = [];
  if (out.length && profile?.notify_in_app !== false) {
    const { data } = await supabase.from("notifications").upsert(out, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("title,body,link,type,dedupe_key");
    created = (data ?? []) as N[];
  }
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return NextResponse.json({ unread: count ?? 0, created });
}, 20);
