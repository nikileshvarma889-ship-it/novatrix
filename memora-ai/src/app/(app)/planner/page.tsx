"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, Download, Paperclip, Pencil, PlayCircle, Plus, Repeat, SkipForward, Trash2, Trophy, Wand2 } from "lucide-react";
import { AiLabel, Badge, Button, Card, CardTitle, Empty, Field, Input, PageHeader, Select, Skeleton, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { StudyTimer, TaskEditor, completeTask, KIND_LABEL, type Task } from "@/components/editors";
import { useProfile } from "@/hooks/useProfile";
import { useData, must, postJson } from "@/hooks/useData";
import { supabaseBrowser } from "@/lib/supabase/client";
import { addDaysKey, dayKey, daysUntil, fmt, fmtTime, relative } from "@/lib/dates";
import { SUBJECTS, cn, minutesLabel, subjectName } from "@/lib/utils";
import { CHAPTERS } from "@/lib/syllabus";

type TabId = "today" | "week" | "month" | "tasks" | "assignments" | "ai";
const SUBJ_DOT: Record<string, string> = { mathematics: "bg-math", physics: "bg-phys", chemistry: "bg-chem" };
const when = (t: Task) => t.start_at ?? t.due_at;

function PlannerInner() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { profile, update } = useProfile();
  const tz = profile.timezone;
  const [tab, setTab] = useState<TabId>((params.get("tab") as TabId) || "today");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState<Partial<Task> | null>(null);
  const [timer, setTimer] = useState<Task | null>(null);

  const { data: tasks, loading, reload, setData } = useData(async () => must(await supabaseBrowser().from("tasks").select("*").order("start_at", { ascending: true, nullsFirst: false }).order("due_at", { ascending: true, nullsFirst: false }).limit(2000)) as Task[]);
  const all = tasks ?? [];

  const done = async (t: Task) => {
    if (t.status === "completed") {
      const { error } = await supabaseBrowser().from("tasks").update({ status: "not_started", completed_at: null }).eq("id", t.id);
      if (error) return toast(error.message, "error");
      return reload();
    }
    const err = await completeTask(t);
    if (err) toast(err, "error"); else { toast(t.recurrence !== "none" ? "Done! Next repeat scheduled." : "Marked complete."); reload(); }
  };
  const remove = async (t: Task) => {
    if (!confirm(`Delete “${t.title}”?`)) return;
    const { error } = await supabaseBrowser().from("tasks").delete().eq("id", t.id);
    if (error) return toast(error.message, "error");
    setData((d) => d?.filter((x) => x.id !== t.id) ?? d);
  };
  const postpone = async (t: Task) => {
    const shift = (s: string | null) => (s ? new Date(new Date(s).getTime() + 86400000).toISOString() : null);
    const { error } = await supabaseBrowser().from("tasks").update({ start_at: shift(t.start_at), due_at: shift(t.due_at), remind_at: shift(t.remind_at) }).eq("id", t.id);
    if (error) return toast(error.message, "error");
    toast("Moved to the next day."); reload();
  };
  const actions = { done, remove, postpone, edit: setEditing, start: setTimer };

  const examIn = profile.exam_date ? daysUntil(profile.exam_date, tz) : null;

  return (
    <div className="space-y-5">
      <PageHeader title="Study Planner" sub={`Timetable, homework and revision · ${tz}`} icon={<CalendarDays className="h-5 w-5" />}
        actions={<><Button variant="secondary" onClick={() => setTab("ai")}><Wand2 className="h-4 w-4" />AI study plan</Button><Button onClick={() => setCreating({ kind: tab === "assignments" ? "assignment" : "task" })}><Plus className="h-4 w-4" />Add</Button></>} />

      <ExamCountdown examIn={examIn} name={profile.exam_name} date={profile.exam_date} onSave={async (name, date) => { const { error } = await update({ exam_name: name || null, exam_date: date || null }); if (error) toast(error, "error"); else toast("Exam date saved."); }} />

      <Tabs value={tab} onChange={(t) => { setTab(t); router.replace(`/planner?tab=${t}`, { scroll: false }); }} className="w-full sm:w-fit"
        tabs={[{ id: "today", label: "Today" }, { id: "week", label: "Week" }, { id: "month", label: "Month" }, { id: "tasks", label: "Tasks" }, { id: "assignments", label: "Assignments" }, { id: "ai", label: "✦ AI plan" }]} />

      {loading ? <Skeleton className="h-96" /> : (
        <>
          {tab === "today" && <DayView day={dayKey(new Date(), tz)} tasks={all} tz={tz} a={actions} onAdd={(k) => setCreating({ kind: k })} />}
          {tab === "week" && <WeekView tasks={all} tz={tz} a={actions} />}
          {tab === "month" && <MonthView tasks={all} tz={tz} a={actions} />}
          {tab === "tasks" && <TaskList tasks={all.filter((t) => !["study_session", "revision", "assignment"].includes(t.kind))} tz={tz} a={actions} />}
          {tab === "assignments" && <Assignments tasks={all.filter((t) => t.kind === "assignment")} tz={tz} a={actions} onAdd={() => setCreating({ kind: "assignment" })} onChange={reload} />}
          {tab === "ai" && <AiPlan tz={tz} examDate={profile.exam_date} examName={profile.exam_name} onSaved={() => { reload(); setTab("week"); }} existing={all} />}
        </>
      )}

      <TaskEditor open={!!editing || !!creating} task={editing} defaults={creating ?? undefined} onClose={() => { setEditing(null); setCreating(null); }} onSaved={reload} />
      <StudyTimer open={!!timer} onClose={() => setTimer(null)} preset={timer ? { subject: timer.subject, chapter_id: timer.chapter_id, task_id: timer.id, title: timer.title } : undefined} onLogged={reload} />
    </div>
  );
}

type Actions = { done: (t: Task) => void; remove: (t: Task) => void; postpone: (t: Task) => void; edit: (t: Task) => void; start: (t: Task) => void };

function ExamCountdown({ examIn, name, date, onSave }: { examIn: number | null; name: string | null; date: string | null; onSave: (n: string, d: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [n, setN] = useState(name ?? "");
  const [d, setD] = useState(date ?? "");
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-grad text-white shadow-glow"><Trophy className="h-6 w-6" /></div>
        {examIn !== null && !edit ? (
          <div><div className="text-2xl font-bold">{examIn > 0 ? `${examIn} days` : examIn === 0 ? "Today!" : "Finished"}</div><div className="text-sm text-muted">{examIn >= 0 ? "until " : "since "}{name || "your exam"} · {fmt(date + "T00:00:00Z", "UTC")}</div></div>
        ) : !edit ? <div><div className="font-semibold">Exam countdown</div><div className="text-sm text-muted">Set your exam date to see a countdown and get reminders.</div></div> : null}
      </div>
      {edit ? (
        <form className="flex flex-1 flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); onSave(n, d); setEdit(false); }}>
          <Field label="Exam" className="min-w-[160px] flex-1"><Input value={n} onChange={(e) => setN(e.target.value)} placeholder="e.g. AP EAPCET 2027" maxLength={100} /></Field>
          <Field label="Date"><Input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
          <Button type="submit">Save</Button><Button type="button" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
        </form>
      ) : <Button variant="secondary" size="sm" className="sm:ml-auto" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />{date ? "Change" : "Set exam date"}</Button>}
    </Card>
  );
}

function Item({ t, tz, a, showDate }: { t: Task; tz: string; a: Actions; showDate?: boolean }) {
  const overdue = t.status !== "completed" && t.due_at && new Date(t.due_at) < new Date() && !["study_session", "revision"].includes(t.kind);
  const session = t.kind === "study_session" || t.kind === "revision";
  const time = when(t);
  return (
    <div className={cn("group flex items-center gap-3 rounded-xl border px-3 py-2.5", overdue ? "border-danger/35 bg-danger/5" : "border-border/60 bg-surface-2/40")}>
      <button onClick={() => a.done(t)} aria-label={t.status === "completed" ? "Mark as not done" : "Mark complete"} className="shrink-0">
        {t.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-ok" /> : <Circle className={cn("h-5 w-5", overdue ? "text-danger" : "text-subtle hover:text-ok")} />}
      </button>
      {t.subject && <span className={cn("h-8 w-1 shrink-0 rounded-full", SUBJ_DOT[t.subject] ?? "bg-brand")} />}
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-sm font-medium", t.status === "completed" && "text-muted line-through")}>{t.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>{KIND_LABEL[t.kind]}</span>
          {time && <span>{showDate ? fmt(time, tz, { weekday: "short", day: "numeric", month: "short" }) + " · " : ""}{fmtTime(time, tz)}{t.duration_minutes ? ` · ${minutesLabel(t.duration_minutes)}` : ""}</span>}
          {t.subject && <span>{subjectName(t.subject)}</span>}
          {overdue && <span className="font-medium text-danger">Overdue {relative(t.due_at!)}</span>}
          {t.recurrence !== "none" && <Repeat className="h-3 w-3" />}
          {t.attachment_path && <Paperclip className="h-3 w-3" />}
        </div>
      </div>
      {t.priority === "high" && t.status !== "completed" && <Badge tone="danger">High</Badge>}
      <div className="flex shrink-0 gap-0.5">
        {session && t.status !== "completed" && <button onClick={() => a.start(t)} className="rounded-md p-1.5 text-brand hover:bg-surface-2" aria-label="Start session" title="Start"><PlayCircle className="h-4 w-4" /></button>}
        <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100">
          {t.status !== "completed" && <button onClick={() => a.postpone(t)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Move to next day" title="Reschedule +1 day"><SkipForward className="h-4 w-4" /></button>}
          <button onClick={() => a.edit(t)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => a.remove(t)} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-danger" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

function onDay(tasks: Task[], day: string, tz: string) {
  return tasks.filter((t) => when(t) && dayKey(when(t)!, tz) === day).sort((a, b) => when(a)!.localeCompare(when(b)!));
}

function DayView({ day, tasks, tz, a, onAdd }: { day: string; tasks: Task[]; tz: string; a: Actions; onAdd: (k: Task["kind"]) => void }) {
  const items = onDay(tasks, day, tz);
  const sessions = items.filter((t) => t.kind === "study_session" || t.kind === "revision");
  const other = items.filter((t) => !sessions.includes(t));
  const overdue = tasks.filter((t) => t.status !== "completed" && t.due_at && dayKey(t.due_at, tz) < day && !["study_session", "revision"].includes(t.kind));
  const planned = sessions.reduce((s, t) => s + (t.duration_minutes ?? 0), 0);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardTitle icon={<Clock className="h-4 w-4" />} title="Study timetable" sub={`${fmt(day + "T12:00:00Z", "UTC", { weekday: "long", day: "numeric", month: "long" })} · ${minutesLabel(planned)} planned`} action={<Button size="sm" variant="secondary" onClick={() => onAdd("study_session")}><Plus className="h-4 w-4" />Session</Button>} />
        {sessions.length ? <div className="space-y-2">{sessions.map((t) => <Item key={t.id} t={t} tz={tz} a={a} />)}</div> : <Empty icon={<Clock className="h-5 w-5" />} title="No study sessions today" text="Add one, or let the AI build a realistic timetable." />}
      </Card>
      <div className="space-y-5">
        {overdue.length > 0 && <Card className="border-danger/30"><CardTitle icon={<AlertTriangle className="h-4 w-4" />} title="Overdue" /><div className="space-y-2">{overdue.map((t) => <Item key={t.id} t={t} tz={tz} a={a} showDate />)}</div></Card>}
        <Card>
          <CardTitle icon={<CheckCircle2 className="h-4 w-4" />} title="Due today & reminders" action={<Button size="sm" variant="secondary" onClick={() => onAdd("task")}><Plus className="h-4 w-4" />Task</Button>} />
          {other.length ? <div className="space-y-2">{other.map((t) => <Item key={t.id} t={t} tz={tz} a={a} />)}</div> : <p className="text-sm text-muted">Nothing else today.</p>}
        </Card>
      </div>
    </div>
  );
}

function WeekView({ tasks, tz, a }: { tasks: Task[]; tz: string; a: Actions }) {
  const [offset, setOffset] = useState(0);
  const today = dayKey(new Date(), tz);
  const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDaysKey(today, -dow + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-sm font-semibold">{fmt(days[0] + "T12:00:00Z", "UTC", { day: "numeric", month: "short" })} – {fmt(days[6] + "T12:00:00Z", "UTC", { day: "numeric", month: "short", year: "numeric" })}</div>
        <Button size="icon" variant="ghost" onClick={() => setOffset((o) => o + 1)} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
        {offset !== 0 && <Button size="sm" variant="ghost" onClick={() => setOffset(0)}>This week</Button>}
      </div>
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const items = onDay(tasks, d, tz);
          const mins = items.filter((t) => t.kind === "study_session" || t.kind === "revision").reduce((s, t) => s + (t.duration_minutes ?? 0), 0);
          return (
            <div key={d} className={cn("card min-h-[140px] p-2.5", d === today && "border-brand/50")}>
              <div className="mb-2 flex items-baseline justify-between px-1"><span className={cn("text-xs font-semibold uppercase", d === today ? "text-brand" : "text-muted")}>{fmt(d + "T12:00:00Z", "UTC", { weekday: "short", day: "numeric" })}</span>{mins > 0 && <span className="text-[10px] text-subtle">{minutesLabel(mins)}</span>}</div>
              <div className="space-y-1.5">
                {items.map((t) => (
                  <button key={t.id} onClick={() => a.edit(t)} className={cn("w-full rounded-lg border border-border/60 bg-surface-2/50 px-2 py-1.5 text-left text-[11.5px] hover:border-brand/40", t.status === "completed" && "opacity-50 line-through")}>
                    <div className="flex items-center gap-1.5"><span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SUBJ_DOT[t.subject ?? ""] ?? "bg-brand")} /><span className="truncate font-medium">{t.title}</span></div>
                    <div className="text-[10px] text-muted">{fmtTime(when(t)!, tz)} · {KIND_LABEL[t.kind]}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ tasks, tz, a }: { tasks: Task[]; tz: string; a: Actions }) {
  const today = dayKey(new Date(), tz);
  const [ym, setYm] = useState(today.slice(0, 7));
  const [sel, setSel] = useState(today);
  const [y, m] = ym.split("-").map(Number);
  const first = `${ym}-01`;
  const startDow = (new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((startDow + daysInMonth) / 7) * 7 }, (_, i) => addDaysKey(first, i - startDow));
  const byDay = useMemo(() => { const mp = new Map<string, Task[]>(); tasks.forEach((t) => { const w = when(t); if (w) { const k = dayKey(w, tz); mp.set(k, [...(mp.get(k) ?? []), t]); } }); return mp; }, [tasks, tz]);
  const shift = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setYm(d.toISOString().slice(0, 7)); };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-sm font-semibold">{new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</div>
          <Button size="icon" variant="ghost" onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-subtle">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const items = byDay.get(d) ?? [];
            const inMonth = d.startsWith(ym);
            return (
              <button key={d} onClick={() => setSel(d)} className={cn("flex min-h-[64px] flex-col rounded-lg border p-1.5 text-left transition sm:min-h-[84px]", sel === d ? "border-brand/60 bg-brand/10" : "border-border/40 hover:border-border", !inMonth && "opacity-35")}>
                <span className={cn("text-xs", d === today ? "grid h-5 w-5 place-items-center rounded-full bg-brand font-bold text-white" : "text-muted")}>{+d.slice(8)}</span>
                <div className="mt-1 hidden space-y-0.5 sm:block">{items.slice(0, 2).map((t) => <div key={t.id} className="truncate rounded bg-surface-2 px-1 text-[10px]">{t.title}</div>)}{items.length > 2 && <div className="text-[10px] text-subtle">+{items.length - 2} more</div>}</div>
                <div className="mt-auto flex gap-0.5 sm:hidden">{items.slice(0, 4).map((t) => <span key={t.id} className={cn("h-1.5 w-1.5 rounded-full", SUBJ_DOT[t.subject ?? ""] ?? "bg-brand")} />)}</div>
              </button>
            );
          })}
        </div>
      </Card>
      <Card>
        <CardTitle icon={<CalendarRange className="h-4 w-4" />} title={fmt(sel + "T12:00:00Z", "UTC", { weekday: "long", day: "numeric", month: "long" })} />
        {(byDay.get(sel) ?? []).length ? <div className="space-y-2">{(byDay.get(sel) ?? []).sort((p, q) => when(p)!.localeCompare(when(q)!)).map((t) => <Item key={t.id} t={t} tz={tz} a={a} />)}</div> : <p className="text-sm text-muted">Nothing scheduled.</p>}
      </Card>
    </div>
  );
}

function TaskList({ tasks, tz, a }: { tasks: Task[]; tz: string; a: Actions }) {
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("all");
  const [pri, setPri] = useState("all");
  const list = tasks.filter((t) => (status === "all" || (status === "open" ? t.status !== "completed" : t.status === status)) && (kind === "all" || t.kind === kind) && (pri === "all" || t.priority === pri))
    .sort((x, y) => (when(x) ?? "9999").localeCompare(when(y) ?? "9999"));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40"><option value="open">Open</option><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="all">All</option></Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-40"><option value="all">All types</option><option value="task">Tasks</option><option value="reminder">Reminders</option><option value="exam">Exams</option></Select>
        <Select value={pri} onChange={(e) => setPri(e.target.value)} className="w-36"><option value="all">Any priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select>
      </div>
      {list.length ? <div className="space-y-2">{list.map((t) => <Item key={t.id} t={t} tz={tz} a={a} showDate />)}</div> : <Empty icon={<CheckCircle2 className="h-5 w-5" />} title="No tasks here" />}
    </div>
  );
}

function Assignments({ tasks, tz, a, onAdd, onChange }: { tasks: Task[]; tz: string; a: Actions; onAdd: () => void; onChange: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const now = new Date();
  const list = tasks.filter((t) => (subject === "all" || t.subject === subject) && (status === "all" || (status === "overdue" ? t.status !== "completed" && t.due_at && new Date(t.due_at) < now : t.status === status))
    && (!from || (t.due_at && dayKey(t.due_at, tz) >= from)) && (!to || (t.due_at && dayKey(t.due_at, tz) <= to)))
    .sort((x, y) => (x.due_at ?? "9999").localeCompare(y.due_at ?? "9999"));
  const overdueCount = tasks.filter((t) => t.status !== "completed" && t.due_at && new Date(t.due_at) < now).length;
  const setSt = async (t: Task, s: Task["status"]) => {
    const { error } = await supabaseBrowser().from("tasks").update({ status: s, completed_at: s === "completed" ? new Date().toISOString() : null }).eq("id", t.id);
    if (error) toast(error.message, "error"); else onChange();
  };
  const download = async (t: Task) => {
    const { data, error } = await supabaseBrowser().storage.from("user-files").createSignedUrl(t.attachment_path!, 120);
    if (error || !data) return toast("Couldn't open the attachment.", "error");
    window.open(data.signedUrl, "_blank", "noopener");
  };
  return (
    <div className="space-y-3">
      {overdueCount > 0 && <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"><AlertTriangle className="h-4 w-4" />{overdueCount} overdue assignment{overdueCount === 1 ? "" : "s"}</div>}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Subject"><Select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-40"><option value="all">All subjects</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40"><option value="all">Any status</option><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="overdue">Overdue</option></Select></Field>
        <Field label="Due from"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></Field>
        <Field label="Due to"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></Field>
      </div>
      {!list.length ? <Empty icon={<Paperclip className="h-5 w-5" />} title="No assignments" text="Track homework with due dates, attachments and status." action={<Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" />Add assignment</Button>} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((t) => {
            const overdue = t.status !== "completed" && t.due_at && new Date(t.due_at) < now;
            return (
              <Card key={t.id} className={cn("p-4", overdue && "border-danger/40")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><h3 className="font-semibold">{t.title}</h3><div className="mt-0.5 text-xs text-muted">{subjectName(t.subject)}{t.chapter_id ? ` · ${CHAPTERS.find((c) => c.id === t.chapter_id)?.title ?? ""}` : ""}</div></div>
                  <Badge tone={t.priority === "high" ? "danger" : t.priority === "medium" ? "warn" : "default"}>{t.priority}</Badge>
                </div>
                {t.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{t.description}</p>}
                <div className={cn("mt-3 text-sm", overdue ? "font-medium text-danger" : "text-muted")}>{t.due_at ? <>{overdue ? "Overdue — was due " : "Due "}{fmt(t.due_at, tz, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} ({relative(t.due_at)})</> : "No due date"}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                  <Select value={t.status} onChange={(e) => setSt(t, e.target.value as Task["status"])} className="h-8 w-36 py-1 text-xs" aria-label="Status"><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></Select>
                  {t.attachment_path && <Button size="sm" variant="ghost" onClick={() => download(t)}><Download className="h-4 w-4" />Attachment</Button>}
                  <div className="ml-auto flex"><button onClick={() => a.edit(t)} className="rounded-md p-1.5 text-muted hover:text-fg" aria-label="Edit"><Pencil className="h-4 w-4" /></button><button onClick={() => a.remove(t)} className="rounded-md p-1.5 text-muted hover:text-danger" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

type PlanSession = { title: string; subject: string; chapter_id: string | null; start_at: string; duration_minutes: number; kind: "study_session" | "revision" };
function AiPlan({ tz, examDate, examName, onSaved, existing }: { tz: string; examDate: string | null; examName: string | null; onSaved: () => void; existing: Task[] }) {
  const toast = useToast();
  const [f, setF] = useState({ examName: examName ?? "", examDate: examDate ?? "", hours: 3, subjects: ["mathematics", "physics", "chemistry"] as string[], times: ["morning", "evening"] as string[], level: "average", rest: [] as number[], chapters: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlanSession[] | null>(null);
  const [saving, setSaving] = useState(false);
  const plans = Array.from(new Set(existing.filter((t) => t.plan_id).map((t) => t.plan_id!)));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const generate = async () => {
    if (!f.examDate) return toast("Please choose the exam date.", "error");
    if (!f.subjects.length || !f.times.length) return toast("Choose at least one subject and one time slot.", "error");
    setBusy(true); setPlan(null);
    try {
      const r = await postJson<{ sessions: PlanSession[] }>("/api/ai/study-plan", { examName: f.examName || "Exam", examDate: f.examDate, subjects: f.subjects, chapterIds: f.chapters, hoursPerDay: f.hours, preferredTimes: f.times, level: f.level, timezone: tz, restDays: f.rest });
      setPlan(r.sessions);
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't create a plan.", "error"); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!plan) return;
    setSaving(true);
    const plan_id = crypto.randomUUID();
    const rows = plan.map((s) => ({ ...s, plan_id, priority: "medium", description: "From your AI study plan" }));
    let error = null;
    for (let i = 0; i < rows.length && !error; i += 200) ({ error } = await supabaseBrowser().from("tasks").insert(rows.slice(i, i + 200)));
    setSaving(false);
    if (error) return toast(`Plan not saved: ${error.message}`, "error");
    toast(`Saved ${rows.length} study sessions to your planner.`);
    setPlan(null); onSaved();
  };
  const removePlan = async (id: string) => {
    if (!confirm("Delete all upcoming, unfinished sessions from this AI plan?")) return;
    const { error } = await supabaseBrowser().from("tasks").delete().eq("plan_id", id).neq("status", "completed").gte("start_at", new Date().toISOString());
    if (error) toast(error.message, "error"); else { toast("Plan removed."); onSaved(); }
  };
  const byDay = useMemo(() => { const mp = new Map<string, PlanSession[]>(); plan?.forEach((s) => { const k = dayKey(s.start_at, tz); mp.set(k, [...(mp.get(k) ?? []), s]); }); return Array.from(mp.entries()); }, [plan, tz]);
  const totalHours = plan ? Math.round(plan.reduce((s, x) => s + x.duration_minutes, 0) / 6) / 10 : 0;
  const times = [["early_morning", "Early morning"], ["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"], ["night", "Night"]] as const;
  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <Card className="h-fit">
        <CardTitle icon={<Wand2 className="h-4 w-4" />} title="AI study plan generator" sub="Realistic sessions with breaks and revision time" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Exam"><Input value={f.examName} onChange={(e) => setF({ ...f, examName: e.target.value })} placeholder="EAPCET" /></Field>
            <Field label="Exam date"><Input type="date" value={f.examDate} min={dayKey(new Date(), tz)} onChange={(e) => setF({ ...f, examDate: e.target.value })} /></Field>
          </div>
          <div><span className="label">Subjects</span><div className="flex flex-wrap gap-2">{SUBJECTS.map((s) => <Chip key={s.id} on={f.subjects.includes(s.id)} onClick={() => setF({ ...f, subjects: toggle(f.subjects, s.id), chapters: f.chapters.filter((c) => CHAPTERS.find((x) => x.id === c)?.subject !== s.id || !f.subjects.includes(s.id)) })}>{s.name}</Chip>)}</div></div>
          <Field label={`Chapters (${f.chapters.length || "all"} selected)`} hint="Leave empty to include every chapter of the chosen subjects.">
            <select multiple value={f.chapters} onChange={(e) => setF({ ...f, chapters: Array.from(e.target.selectedOptions).map((o) => o.value) })} className="input h-32 py-1 text-xs">
              {CHAPTERS.filter((c) => f.subjects.includes(c.subject)).map((c) => <option key={c.id} value={c.id}>{subjectName(c.subject)} {c.paper} · {c.title}</option>)}
            </select>
          </Field>
          <Field label={`Study hours per day: ${f.hours} h`}><input type="range" min={0.5} max={8} step={0.5} value={f.hours} onChange={(e) => setF({ ...f, hours: +e.target.value })} className="w-full accent-[rgb(var(--brand))]" /></Field>
          <div><span className="label">Preferred times</span><div className="flex flex-wrap gap-2">{times.map(([id, l]) => <Chip key={id} on={f.times.includes(id)} onClick={() => setF({ ...f, times: toggle(f.times, id) })}>{l}</Chip>)}</div></div>
          <div><span className="label">Rest days</span><div className="flex flex-wrap gap-1.5">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <Chip key={d} on={f.rest.includes(i)} onClick={() => setF({ ...f, rest: toggle(f.rest, i) })}>{d}</Chip>)}</div></div>
          <Field label="Current preparation"><Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="beginner">Just starting</option><option value="average">Covered some chapters</option><option value="good">Covered most chapters</option><option value="revision_only">Revision only</option></Select></Field>
          <Button onClick={generate} loading={busy} className="w-full"><Wand2 className="h-4 w-4" />{busy ? "Planning your days…" : "Generate timetable"}</Button>
          <p className="text-[11px] text-subtle">Sessions are capped at 90 minutes with breaks in between, and never exceed your daily hours. Times use {tz}.</p>
        </div>
      </Card>
      <div className="space-y-4">
        {plan ? (
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><div className="flex items-center gap-2"><h3 className="font-semibold">Your draft plan</h3><AiLabel /></div><p className="text-sm text-muted">{plan.length} sessions · {totalHours} h over {byDay.length} days — not saved yet.</p></div>
              <div className="flex gap-2"><Button variant="ghost" onClick={() => setPlan(null)}>Discard</Button><Button onClick={save} loading={saving}>Save to planner</Button></div>
            </div>
            <div className="scrollbar-thin max-h-[640px] space-y-3 overflow-y-auto pr-1">
              {byDay.map(([d, list]) => (
                <div key={d}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{fmt(d + "T12:00:00Z", "UTC", { weekday: "short", day: "numeric", month: "short" })} · {minutesLabel(list.reduce((s, x) => s + x.duration_minutes, 0))}</div>
                  <div className="space-y-1">{list.map((s, i) => <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-2/50 px-3 py-1.5 text-sm"><span className="w-16 shrink-0 text-xs text-brand">{fmtTime(s.start_at, tz)}</span><span className={cn("h-2 w-2 shrink-0 rounded-full", SUBJ_DOT[s.subject])} /><span className="min-w-0 flex-1 truncate">{s.title}</span><span className="text-xs text-muted">{s.kind === "revision" ? "Revision · " : ""}{minutesLabel(s.duration_minutes)}</span></div>)}</div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Empty icon={<Wand2 className="h-5 w-5" />} title="Your AI timetable appears here" text="Enter your exam date, subjects and the hours you can really study. You'll review the plan before anything is saved." />
        )}
        {plans.length > 0 && (
          <Card>
            <CardTitle title="Saved AI plans" sub="Remove a plan's remaining sessions if you want to start over" />
            {plans.map((id) => {
              const items = existing.filter((t) => t.plan_id === id);
              const left = items.filter((t) => t.status !== "completed").length;
              const starts = items.map((t) => t.start_at!).filter(Boolean).sort();
              return <div key={id} className="flex items-center justify-between gap-3 border-t border-border/50 py-2.5 text-sm first:border-0"><span>{items.length} sessions · {starts[0] ? fmt(starts[0], tz) : ""} – {starts.at(-1) ? fmt(starts.at(-1)!, tz) : ""} · {left} remaining</span><Button size="sm" variant="ghost" onClick={() => removePlan(id)}><Trash2 className="h-4 w-4" />Remove</Button></div>;
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={on} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", on ? "border-brand/50 bg-brand/15 text-brand" : "border-border text-muted hover:text-fg")}>{children}</button>;
}

export default function PlannerPage() {
  return <Suspense><PlannerInner /></Suspense>;
}

