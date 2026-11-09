"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  ArrowRight, BellRing, BookOpen, Brain, CalendarClock, CheckCircle2, Circle, Clock, NotebookPen, Pin, PlayCircle, Plus, Search, Sparkles, Timer, Youtube,
} from "lucide-react";
import { Avatar } from "@/components/shell/Avatar";
import { Badge, Button, Card, CardTitle, Empty, Progress, Ring, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { MemoryEditor, StudyTimer, TaskEditor, completeTask, KIND_LABEL, type Memory, type Task } from "@/components/editors";
import { useProfile } from "@/hooks/useProfile";
import { useData, must } from "@/hooks/useData";
import { supabaseBrowser } from "@/lib/supabase/client";
import { addDaysKey, dayKey, daysUntil, fmt, fmtTime, greeting, relative, startOfDay } from "@/lib/dates";
import { SUBJECTS, cn, levelName, minutesLabel, truncate } from "@/lib/utils";
import { subjectStats, type ProgressRow } from "@/lib/progress";

const MOTIVATION = [
  "Small steps every day add up to big results.",
  "Revise today what you learned yesterday — it sticks twice as well.",
  "Focus on understanding, not memorising. Marks will follow.",
  "One chapter at a time. You've got this.",
  "Consistency beats intensity. Show up for 30 focused minutes.",
  "Mistakes in practice mean fewer mistakes in the exam.",
  "Your future self will thank you for today's effort.",
];

type SearchHit = { memories: { id: string; title: string; category: string }[]; notes: { id: string; title: string }[]; tasks: { id: string; title: string; kind: string }[]; chapters: { id: string; title: string; subject: string }[] };

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { profile, email, avatarUrl } = useProfile();
  const tz = profile.timezone;
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit | null>(null);
  const [memOpen, setMemOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [timer, setTimer] = useState<{ subject?: string | null; chapter_id?: string | null; task_id?: string | null; title?: string } | null>(null);

  const { data, loading, reload } = useData(async () => {
    const sb = supabaseBrowser();
    const today0 = startOfDay(new Date(), tz).toISOString();
    const today1 = startOfDay(new Date(), tz, 1).toISOString();
    const week = startOfDay(new Date(), tz, 7).toISOString();
    const weekAgo = startOfDay(new Date(), tz, -6).toISOString();
    const [sessions, upcoming, overdue, memCount, recentMem, pinned, accessed, progress, logs, videos] = await Promise.all([
      sb.from("tasks").select("*").in("kind", ["study_session", "revision"]).gte("start_at", today0).lt("start_at", today1).order("start_at"),
      sb.from("tasks").select("*").neq("status", "completed").not("kind", "in", "(study_session,revision)").gte("due_at", today0).lt("due_at", week).order("due_at").limit(8),
      sb.from("tasks").select("*").neq("status", "completed").not("kind", "in", "(study_session,revision)").lt("due_at", today0).order("due_at", { ascending: false }).limit(5),
      sb.from("memories").select("id", { count: "exact", head: true }).eq("archived", false),
      sb.from("memories").select("*").eq("archived", false).order("created_at", { ascending: false }).limit(4),
      sb.from("memories").select("*").eq("archived", false).eq("pinned", true).order("updated_at", { ascending: false }).limit(4),
      sb.from("memories").select("*").not("last_accessed_at", "is", null).order("last_accessed_at", { ascending: false }).limit(3),
      sb.from("chapter_progress").select("chapter_id,track,status,important,personal_notes,revision_due,completed_at"),
      sb.from("study_logs").select("minutes,started_at,subject").gte("started_at", weekAgo),
      sb.from("videos").select("*").not("last_watched_at", "is", null).order("last_watched_at", { ascending: false }).limit(6),
    ]);
    return {
      sessions: must(sessions) as Task[], upcoming: must(upcoming) as Task[], overdue: must(overdue) as Task[],
      memCount: memCount.count ?? 0, recentMem: must(recentMem) as Memory[], pinned: must(pinned) as Memory[], accessed: must(accessed) as Memory[],
      progress: must(progress) as ProgressRow[], logs: must(logs) as { minutes: number; started_at: string; subject: string | null }[],
      videos: must(videos) as { video_id: string; title: string; channel_title: string; thumbnail_url: string | null; last_position_seconds: number; duration_seconds: number | null; watched: boolean; saved: boolean }[],
    };
  }, [tz]);

  // instant search
  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return; }
    const id = setTimeout(async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (r.ok) setHits(await r.json());
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const motivation = MOTIVATION[new Date().getDate() % MOTIVATION.length];
  const level = profile.study_level;
  const stats = useMemo(() => (data ? SUBJECTS.map((s) => ({ ...s, ...subjectStats(data.progress, level, s.id) })) : []), [data, level]);
  const overall = stats.length ? Math.round((stats.reduce((a, s) => a + s.completed, 0) / Math.max(1, stats.reduce((a, s) => a + s.total, 0))) * 100) : 0;
  const week = useMemo(() => {
    const todayKey = dayKey(new Date(), tz);
    const days = Array.from({ length: 7 }, (_, i) => addDaysKey(todayKey, i - 6));
    const map = new Map(days.map((d) => [d, 0]));
    data?.logs.forEach((l) => { const k = dayKey(l.started_at, tz); if (map.has(k)) map.set(k, map.get(k)! + l.minutes); });
    return days.map((d) => ({ day: new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }), minutes: map.get(d)! }));
  }, [data, tz]);
  const weekTotal = week.reduce((a, d) => a + d.minutes, 0);
  const examIn = profile.exam_date ? daysUntil(profile.exam_date, tz) : null;
  const continueVid = data?.videos.find((v) => !v.watched && v.last_position_seconds > 20);

  const done = async (t: Task) => {
    const err = await completeTask(t);
    if (err) toast(err, "error"); else { toast("Marked complete."); reload(); }
  };

  const ask = () => q.trim() && router.push(`/assistant?q=${encodeURIComponent(q.trim())}`);

  return (
    <div className="space-y-5">
      {/* welcome + AI search */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={profile.full_name} email={email} url={avatarUrl} size={52} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-subtle">{fmt(new Date(), tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{greeting(tz)}, {profile.full_name.split(" ")[0] || "there"} 👋</h1>
              <p className="mt-1 text-sm text-muted">{motivation}</p>
            </div>
          </div>
          {examIn !== null && examIn >= 0 && (
            <div className="hidden shrink-0 rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 text-center sm:block">
              <div className="text-2xl font-bold text-brand">{examIn}</div>
              <div className="text-[11px] text-muted">day{examIn === 1 ? "" : "s"} to {profile.exam_name || "exam"}</div>
            </div>
          )}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="relative mt-6">
          <Sparkles className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask MEMORA anything or search your memories..." className="input h-14 rounded-2xl pl-12 pr-28 text-[15px] shadow-glow" aria-label="Ask MEMORA or search" />
          <Button type="submit" className="absolute right-2 top-1/2 h-10 -translate-y-1/2" disabled={!q.trim()}>Ask AI</Button>
          {hits && (
            <div className="card absolute inset-x-0 top-16 z-10 max-h-80 overflow-y-auto p-2">
              {[...hits.memories.map((m) => ({ k: "Memory", t: m.title, href: `/memories?open=${m.id}`, icon: Brain })),
                ...hits.notes.map((n) => ({ k: "Note", t: n.title, href: `/notes/${n.id}`, icon: NotebookPen })),
                ...hits.tasks.map((t) => ({ k: KIND_LABEL[t.kind as Task["kind"]] ?? "Task", t: t.title, href: "/planner", icon: CalendarClock })),
                ...hits.chapters.map((c) => ({ k: "Chapter", t: c.title, href: `/study/${c.subject}?chapter=${c.id}`, icon: BookOpen }))].slice(0, 8).map((h, i) => (
                <Link key={i} href={h.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><h.icon className="h-4 w-4 text-brand" /><span className="flex-1 truncate">{h.t}</span><span className="text-xs text-subtle">{h.k}</span></Link>
              ))}
              {!hits.memories.length && !hits.notes.length && !hits.tasks.length && !hits.chapters.length && <div className="px-3 py-2 text-sm text-muted">Nothing saved matches “{q}”. Press <b>Ask AI</b> to ask MEMORA instead.</div>}
              <button type="button" onClick={() => router.push(`/search?q=${encodeURIComponent(q)}`)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand hover:bg-surface-2"><Search className="h-4 w-4" />See all results</button>
            </div>
          )}
        </form>
      </motion.section>

      {/* quick actions */}
      <section className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {[
          { l: "Save a memory", i: Brain, f: () => setMemOpen(true) },
          { l: "Ask AI", i: Sparkles, f: () => router.push("/assistant") },
          { l: "Create a task", i: Plus, f: () => setTaskOpen(true) },
          { l: "Add a note", i: NotebookPen, f: () => router.push("/notes/new") },
          { l: "Study session", i: Timer, f: () => setTimer({}) },
          { l: "YouTube Learning", i: Youtube, f: () => router.push("/youtube") },
        ].map((a) => (
          <button key={a.l} onClick={a.f} className="card group flex flex-col items-center gap-2 px-2 py-3.5 text-center text-[12px] font-medium text-muted transition hover:-translate-y-0.5 hover:border-brand/40 hover:text-fg">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand-grad group-hover:text-white"><a.i className="h-[18px] w-[18px]" /></span>{a.l}
          </button>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* today's schedule */}
        <Card className="lg:col-span-2">
          <CardTitle icon={<CalendarClock className="h-4 w-4" />} title="Today's schedule" sub="Study sessions, deadlines and reminders" action={<Link href="/planner" className="text-xs text-brand hover:underline">Open planner</Link>} />
          {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div> : (
            <div className="space-y-4">
              {data!.overdue.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-danger">Overdue</div>
                  {data!.overdue.map((t) => <TaskRow key={t.id} t={t} tz={tz} onDone={done} overdue />)}
                </div>
              )}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Study sessions today</div>
                {data!.sessions.length ? data!.sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-2/40 px-3 py-2.5">
                    <div className="w-16 shrink-0 text-xs font-semibold text-brand">{fmtTime(s.start_at!, tz)}</div>
                    <div className="min-w-0 flex-1"><div className={cn("truncate text-sm font-medium", s.status === "completed" && "text-muted line-through")}>{s.title}</div><div className="text-xs text-muted">{s.duration_minutes ? minutesLabel(s.duration_minutes) : ""}{s.subject ? ` · ${SUBJECTS.find((x) => x.id === s.subject)?.name}` : ""}</div></div>
                    {s.status !== "completed" ? <Button size="sm" variant="secondary" onClick={() => setTimer({ subject: s.subject, chapter_id: s.chapter_id, task_id: s.id, title: s.title })}><PlayCircle className="h-4 w-4" />Start</Button> : <CheckCircle2 className="h-5 w-5 text-ok" />}
                  </div>
                )) : <p className="text-sm text-muted">No sessions scheduled today. <button onClick={() => router.push("/planner?tab=ai")} className="text-brand hover:underline">Generate a study plan</button></p>}
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Coming up (7 days)</div>
                {data!.upcoming.length ? data!.upcoming.map((t) => <TaskRow key={t.id} t={t} tz={tz} onDone={done} />) : <p className="text-sm text-muted">Nothing due this week.</p>}
              </div>
            </div>
          )}
        </Card>

        {/* progress */}
        <Card>
          <CardTitle icon={<BookOpen className="h-4 w-4" />} title="Study progress" sub={levelName(level)} action={<Link href="/progress" className="text-xs text-brand hover:underline">Details</Link>} />
          {loading ? <Skeleton className="h-48" /> : (
            <>
              <div className="flex items-center gap-4">
                <Ring value={overall} size={84} stroke={8} />
                <div className="text-sm"><div className="font-semibold">{stats.reduce((a, s) => a + s.completed, 0)} of {stats.reduce((a, s) => a + s.total, 0)} chapters</div><div className="text-muted">completed overall</div></div>
              </div>
              <div className="mt-5 space-y-3">
                {stats.map((s) => (
                  <Link key={s.id} href={`/study/${s.id}`} className="block">
                    <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{s.name}</span><span className="text-muted">{s.completed}/{s.total} · {s.pending} pending</span></div>
                    <Progress value={s.pct} tone={s.color} />
                  </Link>
                ))}
              </div>
              <div className="mt-5 border-t border-border/60 pt-4">
                <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium">This week</span><span className="text-muted">{minutesLabel(weekTotal)} studied</span></div>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={week}><XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} stroke="rgb(var(--subtle))" /><Tooltip cursor={{ fill: "rgb(var(--surface-2))" }} contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [minutesLabel(v), "Studied"]} /><Bar dataKey="minutes" fill="rgb(var(--brand))" radius={[5, 5, 0, 0]} /></BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* memories */}
        <Card className="lg:col-span-2">
          <CardTitle icon={<Brain className="h-4 w-4" />} title="Memory overview" sub={loading ? " " : `${data!.memCount} saved memor${data!.memCount === 1 ? "y" : "ies"}`} action={<Link href="/memories" className="text-xs text-brand hover:underline">All memories</Link>} />
          {loading ? <Skeleton className="h-40" /> : data!.memCount === 0 ? (
            <Empty icon={<Brain className="h-5 w-5" />} title="No memories yet" text="Save assignments, teacher instructions, formulas or anything you want MEMORA to remember." action={<Button size="sm" onClick={() => setMemOpen(true)}><Plus className="h-4 w-4" />Save your first memory</Button>} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <MemList title="Pinned" icon={<Pin className="h-3.5 w-3.5" />} items={data!.pinned} empty="Pin important memories to keep them here." tz={tz} />
              <MemList title="Recently saved" icon={<Clock className="h-3.5 w-3.5" />} items={data!.recentMem} empty="" tz={tz} />
              {data!.accessed.length > 0 && <MemList title="Recently used by MEMORA" icon={<Sparkles className="h-3.5 w-3.5" />} items={data!.accessed} empty="" tz={tz} accessed />}
            </div>
          )}
        </Card>

        {/* youtube */}
        <Card>
          <CardTitle icon={<Youtube className="h-4 w-4" />} title="Keep learning" sub="Continue watching & saved videos" action={<Link href="/youtube" className="text-xs text-brand hover:underline">Open</Link>} />
          {loading ? <Skeleton className="h-40" /> : !data!.videos.length ? (
            <Empty icon={<Youtube className="h-5 w-5" />} title="No videos yet" text="Find chapter-wise lessons without leaving MEMORA." action={<Link href="/youtube"><Button size="sm" variant="secondary">Browse lessons</Button></Link>} />
          ) : (
            <div className="space-y-2.5">
              {continueVid && (
                <Link href={`/youtube/watch/${continueVid.video_id}`} className="group block overflow-hidden rounded-xl border border-border/60">
                  <div className="relative aspect-video bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {continueVid.thumbnail_url && <img src={continueVid.thumbnail_url} alt="" className="h-full w-full object-cover" />}
                    <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition group-hover:opacity-100"><PlayCircle className="h-12 w-12 text-white" /></div>
                    {continueVid.duration_seconds ? <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40"><div className="h-full bg-danger" style={{ width: `${Math.min(100, (continueVid.last_position_seconds / continueVid.duration_seconds) * 100)}%` }} /></div> : null}
                  </div>
                  <div className="p-2.5"><div className="text-[11px] font-semibold uppercase text-brand">Continue watching</div><div className="truncate text-sm font-medium">{continueVid.title}</div></div>
                </Link>
              )}
              {data!.videos.filter((v) => v !== continueVid).slice(0, 3).map((v) => (
                <Link key={v.video_id} href={`/youtube/watch/${v.video_id}`} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" className="h-10 w-16 rounded-md object-cover" /> : <div className="h-10 w-16 rounded-md bg-surface-2" />}
                  <div className="min-w-0"><div className="truncate text-sm">{v.title}</div><div className="truncate text-xs text-muted">{v.channel_title}</div></div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <MemoryEditor open={memOpen} onClose={() => setMemOpen(false)} onSaved={() => reload()} />
      <TaskEditor open={taskOpen} onClose={() => setTaskOpen(false)} onSaved={() => reload()} />
      <StudyTimer open={!!timer} onClose={() => setTimer(null)} preset={timer ?? undefined} onLogged={() => reload()} />
    </div>
  );
}

function TaskRow({ t, tz, onDone, overdue }: { t: Task; tz: string; onDone: (t: Task) => void; overdue?: boolean }) {
  const Icon = t.kind === "reminder" ? BellRing : t.kind === "exam" ? CalendarClock : Circle;
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", overdue ? "border-danger/30 bg-danger/5" : "border-border/60 bg-surface-2/40")}>
      <button onClick={() => onDone(t)} className="text-subtle transition hover:text-ok" aria-label={`Mark ${t.title} complete`} title="Mark complete"><Icon className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{t.title}</div>
        <div className="text-xs text-muted">{KIND_LABEL[t.kind]}{t.subject ? ` · ${SUBJECTS.find((s) => s.id === t.subject)?.name}` : ""} · {overdue ? "was due " : "due "}{relative(t.due_at!)} ({fmt(t.due_at!, tz, { weekday: "short", hour: "numeric", minute: "2-digit" })})</div>
      </div>
      {t.priority === "high" && <Badge tone="danger">High</Badge>}
    </div>
  );
}

function MemList({ title, icon, items, empty, tz, accessed }: { title: string; icon: React.ReactNode; items: Memory[]; empty: string; tz: string; accessed?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">{icon}{title}</div>
      {items.length ? (
        <div className="space-y-1.5">
          {items.map((m) => (
            <Link key={m.id} href={`/memories?open=${m.id}`} className="group flex items-start gap-2 rounded-xl border border-border/50 bg-surface-2/30 px-3 py-2 hover:border-brand/40">
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium te">{m.title}</div><div className="truncate text-xs text-muted te">{truncate(m.content || m.category, 70)}</div></div>
              <span className="shrink-0 pt-0.5 text-[10px] text-subtle">{accessed && m.last_accessed_at ? relative(m.last_accessed_at) : fmt(m.created_at, tz, { day: "numeric", month: "short" })}</span>
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle opacity-0 transition group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      ) : <p className="text-xs text-muted">{empty}</p>}
    </div>
  );
}
