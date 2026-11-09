"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, BookCheck, ClipboardCheck, Clock, Layers, ListChecks, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardTitle, Empty, PageHeader, Progress, Ring, Skeleton, Tabs } from "@/components/ui";
import { useData, must } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { supabaseBrowser } from "@/lib/supabase/client";
import { addDaysKey, dayKey, startOfDay } from "@/lib/dates";
import { SUBJECTS, levelName, minutesLabel } from "@/lib/utils";
import { subjectStats, type Level, type ProgressRow } from "@/lib/progress";

const COLORS: Record<string, string> = { mathematics: "rgb(var(--math))", physics: "rgb(var(--phys))", chemistry: "rgb(var(--chem))", general: "rgb(var(--subtle))" };
function between(iso: string, a: string, b: string, tz: string) { const k = dayKey(iso, tz); return k >= a && k <= b; }
const TT = { contentStyle: { background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 10, fontSize: 12 }, labelStyle: { color: "rgb(var(--muted))" } };

export default function ProgressPage() {
  const { profile } = useProfile();
  const tz = profile.timezone;
  const level = profile.study_level as Level;
  const [range, setRange] = useState<"7" | "28">("28");
  const { data, loading } = useData(async () => {
    const sb = supabaseBrowser();
    const since = startOfDay(new Date(), tz, -55).toISOString();
    const [progress, logs, attempts, reviews, tasks] = await Promise.all([
      sb.from("chapter_progress").select("chapter_id,track,status,important,personal_notes,revision_due,completed_at"),
      sb.from("study_logs").select("minutes,started_at,subject").gte("started_at", since),
      sb.from("quiz_attempts").select("score,total,submitted_at,topic_breakdown,quizzes(subject,title)").order("submitted_at"),
      sb.from("flashcard_reviews").select("rating,reviewed_at").gte("reviewed_at", since),
      sb.from("tasks").select("kind,status,due_at,completed_at,start_at,duration_minutes").in("kind", ["assignment", "revision", "study_session"]),
    ]);
    return {
      progress: must(progress) as ProgressRow[], logs: must(logs) as { minutes: number; started_at: string; subject: string | null }[],
      attempts: must(attempts) as unknown as { score: number; total: number; submitted_at: string; quizzes: { subject: string | null; title: string } | null }[],
      reviews: must(reviews) as { rating: number; reviewed_at: string }[], tasks: must(tasks) as { kind: string; status: string; due_at: string | null; completed_at: string | null; start_at: string | null }[],
    };
  }, [tz]);

  const today = dayKey(new Date(), tz);
  const n = +range;
  const days = Array.from({ length: n }, (_, i) => addDaysKey(today, i - n + 1));
  const inRange = (iso: string, a: string, b: string) => between(iso, a, b, tz);

  const subj = useMemo(() => SUBJECTS.map((s) => ({ ...s, ...subjectStats(data?.progress ?? [], level, s.id) })), [data, level]);
  const totals = subj.reduce((a, s) => ({ done: a.done + s.completed, total: a.total + s.total }), { done: 0, total: 0 });

  const daily = useMemo(() => days.map((d) => {
    const row: Record<string, number | string> = { day: d.slice(5), mathematics: 0, physics: 0, chemistry: 0, general: 0, reviews: 0 };
    data?.logs.forEach((l) => { if (dayKey(l.started_at, tz) === d) row[l.subject ?? "general"] = (row[l.subject ?? "general"] as number) + l.minutes; });
    data?.reviews.forEach((r) => { if (dayKey(r.reviewed_at, tz) === d) row.reviews = (row.reviews as number) + 1; });
    return row;
  }), [data, days, tz]);
  const totalMin = (data?.logs ?? []).filter((l) => inRange(l.started_at, days[0], today)).reduce((s, l) => s + l.minutes, 0);
  const bySubject = SUBJECTS.map((s) => ({ name: s.name, id: s.id, value: (data?.logs ?? []).filter((l) => l.subject === s.id && inRange(l.started_at, days[0], today)).reduce((a, l) => a + l.minutes, 0) })).filter((x) => x.value > 0);
  const quiz = (data?.attempts ?? []).map((a, i) => ({ n: i + 1, date: dayKey(a.submitted_at, tz).slice(5), pct: a.total ? Math.round((a.score / a.total) * 100) : 0, title: a.quizzes?.title ?? "" }));
  const assignments = (data?.tasks ?? []).filter((t) => t.kind === "assignment");
  const asgDone = assignments.filter((t) => t.status === "completed").length;
  const revs = (data?.tasks ?? []).filter((t) => t.kind === "revision" && t.start_at && new Date(t.start_at) <= new Date());
  const revDone = revs.filter((t) => t.status === "completed").length;

  // ---- weekly summary: only statements backed by recorded data ----
  const summary = useMemo(() => {
    if (!data) return [];
    const w0a = addDaysKey(today, -6), w1a = addDaysKey(today, -13), w1b = addDaysKey(today, -7);
    const inRange = (iso: string, a: string, b: string) => between(iso, a, b, tz);
    const sum = (a: string, b: string) => data.logs.filter((l) => inRange(l.started_at, a, b));
    const out: { tone: "up" | "down" | "flat"; text: string }[] = [];
    const thisMin = sum(w0a, today).reduce((s, l) => s + l.minutes, 0), lastMin = sum(w1a, w1b).reduce((s, l) => s + l.minutes, 0);
    if (thisMin || lastMin) out.push({ tone: thisMin > lastMin ? "up" : thisMin < lastMin ? "down" : "flat", text: `You studied ${minutesLabel(thisMin)} this week${lastMin ? ` (${minutesLabel(lastMin)} the week before)` : ""}.` });
    for (const s of SUBJECTS) {
      const a = sum(w0a, today).filter((l) => l.subject === s.id).reduce((x, l) => x + l.minutes, 0), b = sum(w1a, w1b).filter((l) => l.subject === s.id).reduce((x, l) => x + l.minutes, 0);
      if (a > 0 && b > 0 && a > b * 1.2) out.push({ tone: "up", text: `Your ${s.name} study time improved this week (${minutesLabel(b)} → ${minutesLabel(a)}).` });
      if (b > 0 && a < b * 0.6) out.push({ tone: "down", text: `${s.name} study time dropped this week (${minutesLabel(b)} → ${minutesLabel(a)}).` });
    }
    const chDone = data.progress.filter((p) => p.completed_at && inRange(p.completed_at, w0a, today)).length;
    if (chDone) out.push({ tone: "up", text: `You completed ${chDone} chapter${chDone === 1 ? "" : "s"} this week.` });
    const qa = data.attempts.filter((a) => inRange(a.submitted_at, w0a, today)), qb = data.attempts.filter((a) => inRange(a.submitted_at, w1a, w1b));
    const avg = (l: typeof qa) => Math.round((l.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) / l.length) * 100);
    if (qa.length) out.push({ tone: qb.length ? (avg(qa) > avg(qb) ? "up" : avg(qa) < avg(qb) ? "down" : "flat") : "flat", text: `Average quiz score this week: ${avg(qa)}% over ${qa.length} test${qa.length === 1 ? "" : "s"}${qb.length ? ` (last week ${avg(qb)}%)` : ""}.` });
    const rv = data.reviews.filter((r) => inRange(r.reviewed_at, w0a, today)).length;
    if (rv) out.push({ tone: "flat", text: `${rv} flashcard review${rv === 1 ? "" : "s"} completed this week.` });
    const ad = data.tasks.filter((t) => t.kind === "assignment" && t.completed_at && inRange(t.completed_at, w0a, today)).length;
    if (ad) out.push({ tone: "up", text: `${ad} assignment${ad === 1 ? "" : "s"} completed this week.` });
    return out;
  }, [data, today, tz]);

  if (loading) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /></div>;
  return (
    <div className="space-y-5">
      <PageHeader title="Progress" sub={`${levelName(level)} · everything here comes from what you've recorded`} icon={<TrendingUp className="h-5 w-5" />} actions={<Tabs value={range} onChange={setRange} tabs={[{ id: "7", label: "7 days" }, { id: "28", label: "28 days" }]} />} />

      <Card>
        <CardTitle icon={<Activity className="h-4 w-4" />} title="Weekly summary" sub="Compared with the previous 7 days" />
        {summary.length ? <ul className="space-y-2">{summary.map((s, i) => <li key={i} className="flex items-start gap-2.5 text-sm">{s.tone === "up" ? <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : s.tone === "down" ? <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-warn" /> : <Minus className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />}{s.text}</li>)}</ul>
          : <p className="text-sm text-muted">Not enough activity recorded yet. Log study sessions, complete chapters, take quizzes or review flashcards — your weekly summary will appear here.</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: BookCheck, l: "Chapters completed", v: `${totals.done}/${totals.total}`, sub: `${totals.total - totals.done} pending` },
          { icon: Clock, l: `Study time (${range} days)`, v: minutesLabel(totalMin), sub: `${minutesLabel(Math.round(totalMin / n))} per day` },
          { icon: ListChecks, l: "Quizzes taken", v: String(quiz.length), sub: quiz.length ? `avg ${Math.round(quiz.reduce((s, q) => s + q.pct, 0) / quiz.length)}%` : "—" },
          { icon: ClipboardCheck, l: "Assignments done", v: `${asgDone}/${assignments.length}`, sub: assignments.length ? `${Math.round((asgDone / assignments.length) * 100)}% complete` : "—" },
        ].map((k) => <Card key={k.l} className="p-4"><div className="flex items-center gap-2 text-xs text-muted"><k.icon className="h-4 w-4 text-brand" />{k.l}</div><div className="mt-2 text-2xl font-bold">{k.v}</div><div className="text-xs text-subtle">{k.sub}</div></Card>)}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardTitle title="Syllabus progress" sub="Completed chapters per subject" />
          <div className="flex justify-center"><Ring value={(totals.done / Math.max(1, totals.total)) * 100} size={130} stroke={11} /></div>
          <div className="mt-5 space-y-3">{subj.map((s) => <div key={s.id}><div className="mb-1 flex justify-between text-xs"><span className="font-medium">{s.name}</span><span className="text-muted">{s.completed} done · {s.inProgress} in progress · {s.pending} pending</span></div><Progress value={s.pct} tone={s.color} /></div>)}</div>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle icon={<Clock className="h-4 w-4" />} title="Study time" sub="Minutes logged with the study timer, by subject" />
          {totalMin ? (
            <div className="h-64"><ResponsiveContainer><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} /><XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} stroke="rgb(var(--subtle))" interval={n > 7 ? 3 : 0} /><YAxis fontSize={10} tickLine={false} axisLine={false} stroke="rgb(var(--subtle))" width={30} /><Tooltip {...TT} cursor={{ fill: "rgb(var(--surface-2))" }} /><Legend wrapperStyle={{ fontSize: 11 }} />
              {(["mathematics", "physics", "chemistry", "general"] as const).map((k) => <Bar key={k} dataKey={k} name={k === "general" ? "General" : SUBJECTS.find((s) => s.id === k)!.name} stackId="a" fill={COLORS[k]} radius={k === "general" ? [4, 4, 0, 0] : 0} />)}
            </BarChart></ResponsiveContainer></div>
          ) : <Empty icon={<Clock className="h-5 w-5" />} title="No study time logged in this period" text="Use “Start a study session” on the dashboard or planner to record time." />}
        </Card>
        <Card>
          <CardTitle title="Time by subject" />
          {bySubject.length ? <div className="h-56"><ResponsiveContainer><PieChart><Pie data={bySubject} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>{bySubject.map((s) => <Cell key={s.id} fill={COLORS[s.id]} stroke="none" />)}</Pie><Tooltip {...TT} formatter={(v: number) => minutesLabel(v)} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div> : <p className="text-sm text-muted">No subject-tagged study time yet.</p>}
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle icon={<ListChecks className="h-4 w-4" />} title="Quiz scores" sub="Every attempt, in order" />
          {quiz.length ? <div className="h-56"><ResponsiveContainer><LineChart data={quiz}><CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} /><XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} stroke="rgb(var(--subtle))" /><YAxis domain={[0, 100]} fontSize={10} tickLine={false} axisLine={false} stroke="rgb(var(--subtle))" width={30} unit="%" /><Tooltip {...TT} formatter={(v: number) => [`${v}%`, "Score"]} labelFormatter={(_, p) => p?.[0]?.payload?.title ?? ""} /><Line type="monotone" dataKey="pct" stroke="rgb(var(--brand))" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div> : <Empty icon={<ListChecks className="h-5 w-5" />} title="No quiz attempts yet" />}
        </Card>
        <Card>
          <CardTitle icon={<Layers className="h-4 w-4" />} title="Revision completion" />
          <div className="space-y-4">
            <div><div className="mb-1 flex justify-between text-xs"><span>Scheduled revision sessions done</span><span className="text-muted">{revDone}/{revs.length}</span></div><Progress value={revs.length ? (revDone / revs.length) * 100 : 0} tone="ok" /></div>
            <div><div className="mb-1 flex justify-between text-xs"><span>Assignments completed</span><span className="text-muted">{asgDone}/{assignments.length}</span></div><Progress value={assignments.length ? (asgDone / assignments.length) * 100 : 0} /></div>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle icon={<Activity className="h-4 w-4" />} title="Weekly activity" sub="Flashcard reviews per day" />
          {(data?.reviews.length ?? 0) > 0 ? <div className="h-48"><ResponsiveContainer><AreaChart data={daily}><defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--brand))" stopOpacity={0.5} /><stop offset="1" stopColor="rgb(var(--brand))" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="day" fontSize={10} tickLine={false} axisLine={false} stroke="rgb(var(--subtle))" interval={n > 7 ? 3 : 0} /><YAxis allowDecimals={false} fontSize={10} tickLine={false} axisLine={false} stroke="rgb(var(--subtle))" width={30} /><Tooltip {...TT} /><Area type="monotone" dataKey="reviews" name="Reviews" stroke="rgb(var(--brand))" fill="url(#rg)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div> : <p className="text-sm text-muted">No flashcard reviews in this period.</p>}
        </Card>
      </div>
    </div>
  );
}
