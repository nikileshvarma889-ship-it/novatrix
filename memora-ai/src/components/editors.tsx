"use client";
import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Timer } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MEMORY_CATEGORIES, SUBJECTS, formatDuration } from "@/lib/utils";
import { CHAPTERS } from "@/lib/syllabus";
import { fromLocalInput, toLocalInput } from "@/lib/dates";
import { useProfile } from "@/hooks/useProfile";

// ------------------------------------------------------------------ memories
export type Memory = {
  id: string; title: string; content: string; category: string; tags: string[]; priority: "low" | "medium" | "high";
  pinned: boolean; archived: boolean; source: string; created_at: string; updated_at: string; last_accessed_at: string | null;
};

export function MemoryEditor({ open, onClose, memory, onSaved, initial }: { open: boolean; onClose: () => void; memory?: Memory | null; onSaved?: (m: Memory) => void; initial?: Partial<Memory> }) {
  const toast = useToast();
  const [f, setF] = useState({ title: "", content: "", category: "General Notes", tags: "", priority: "medium", pinned: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const m = memory ?? initial;
    setF({ title: m?.title ?? "", content: m?.content ?? "", category: m?.category ?? "General Notes", tags: (m?.tags ?? []).join(", "), priority: m?.priority ?? "medium", pinned: m?.pinned ?? false });
  }, [open, memory, initial]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    setSaving(true);
    const row = { title: f.title.trim(), content: f.content.trim(), category: f.category, priority: f.priority, pinned: f.pinned, tags: f.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12) };
    const sb = supabaseBrowser();
    const r = memory ? await sb.from("memories").update(row).eq("id", memory.id).select("*").single() : await sb.from("memories").insert({ ...row, source: initial?.source ?? "text" }).select("*").single();
    setSaving(false);
    if (r.error) { toast(`Not saved: ${r.error.message}`, "error"); return; }
    toast(memory ? "Memory updated." : "Memory saved.");
    onSaved?.(r.data as Memory);
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={memory ? "Edit memory" : "Save a memory"}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Title"><Input required maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Physics assignment due Friday" className="te" autoFocus /></Field>
        <Field label="What should MEMORA remember?"><Textarea value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder="Write it naturally, in English or Telugu…" className="te min-h-[120px]" maxLength={20000} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{MEMORY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></Field>
        </div>
        <Field label="Tags" hint="Comma separated, e.g. physics, homework"><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--brand))]" />Pin to the top</label>
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>{memory ? "Save changes" : "Save memory"}</Button></div>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ tasks / assignments / sessions
export type Task = {
  id: string; kind: "task" | "assignment" | "study_session" | "revision" | "exam" | "reminder"; title: string; description: string; subject: string | null;
  chapter_id: string | null; start_at: string | null; due_at: string | null; duration_minutes: number | null; priority: "low" | "medium" | "high";
  status: "not_started" | "in_progress" | "completed"; recurrence: "none" | "daily" | "weekly" | "monthly"; recurrence_until: string | null;
  remind_at: string | null; attachment_path: string | null; plan_id: string | null; completed_at: string | null; created_at: string;
};
export const KIND_LABEL: Record<Task["kind"], string> = { task: "Task", assignment: "Assignment", study_session: "Study session", revision: "Revision", exam: "Exam", reminder: "Reminder" };

export function TaskEditor({ open, onClose, task, defaults, onSaved }: { open: boolean; onClose: () => void; task?: Task | null; defaults?: Partial<Task>; onSaved?: () => void }) {
  const toast = useToast();
  const { profile } = useProfile();
  const tz = profile.timezone;
  const blank = { kind: "task" as Task["kind"], title: "", description: "", subject: "", chapter_id: "", start: "", due: "", duration: "", priority: "medium", status: "not_started", recurrence: "none", until: "", remind: "" };
  const [f, setF] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = task ?? defaults;
    setFile(null);
    setF({
      kind: t?.kind ?? "task", title: t?.title ?? "", description: t?.description ?? "", subject: t?.subject ?? "", chapter_id: t?.chapter_id ?? "",
      start: toLocalInput(t?.start_at, tz), due: toLocalInput(t?.due_at, tz), duration: t?.duration_minutes ? String(t.duration_minutes) : "",
      priority: t?.priority ?? "medium", status: t?.status ?? "not_started", recurrence: t?.recurrence ?? "none", until: t?.recurrence_until ?? "", remind: toLocalInput(t?.remind_at, tz),
    });
  }, [open, task, defaults, tz]);
  const scheduled = f.kind === "study_session" || f.kind === "revision";
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    if (scheduled && !f.start) { toast("Please choose when this session starts.", "error"); return; }
    const dur = f.duration ? Math.min(240, Math.max(5, parseInt(f.duration, 10))) : scheduled ? 60 : null;
    setSaving(true);
    const sb = supabaseBrowser();
    let attachment_path = task?.attachment_path ?? null;
    if (file) {
      if (file.size > 20 * 1024 * 1024) { setSaving(false); toast("Attachments must be under 20 MB.", "error"); return; }
      const { data: u } = await sb.auth.getUser();
      const path = `${u.user!.id}/attachments/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await sb.storage.from("user-files").upload(path, file, { contentType: file.type || undefined });
      if (up.error) { setSaving(false); toast(`Attachment upload failed: ${up.error.message}`, "error"); return; }
      attachment_path = path;
    }
    const row = {
      kind: f.kind, title: f.title.trim(), description: f.description.trim(), subject: f.subject || null, chapter_id: f.chapter_id || null,
      start_at: fromLocalInput(f.start, tz), due_at: fromLocalInput(f.due, tz), duration_minutes: dur, priority: f.priority, status: f.status,
      completed_at: f.status === "completed" ? task?.completed_at ?? new Date().toISOString() : null,
      recurrence: f.recurrence, recurrence_until: f.until || null, remind_at: fromLocalInput(f.remind, tz), attachment_path,
    };
    const r = task ? await sb.from("tasks").update(row).eq("id", task.id) : await sb.from("tasks").insert(row);
    setSaving(false);
    if (r.error) { toast(`Not saved: ${r.error.message}`, "error"); return; }
    toast(task ? "Updated." : `${KIND_LABEL[f.kind]} added.`);
    onSaved?.();
    onClose();
  };
  const chapters = CHAPTERS.filter((c) => c.subject === f.subject);
  return (
    <Modal open={open} onClose={onClose} title={task ? `Edit ${KIND_LABEL[task.kind].toLowerCase()}` : "New item"}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Task["kind"] })}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></Field>
        </div>
        <Field label="Title"><Input required maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="te" autoFocus /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="te min-h-[70px]" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject"><Select value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value, chapter_id: "" })}><option value="">—</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Chapter"><Select value={f.chapter_id} onChange={(e) => setF({ ...f, chapter_id: e.target.value })} disabled={!f.subject}><option value="">—</option>{chapters.map((c) => <option key={c.id} value={c.id}>{c.paper} · {c.title}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {scheduled ? (
            <>
              <Field label="Starts"><Input type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
              <Field label="Minutes" hint="5–240"><Input type="number" min={5} max={240} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} placeholder="60" /></Field>
            </>
          ) : (
            <>
              <Field label={f.kind === "exam" || f.kind === "reminder" ? "Date & time" : "Due"}><Input type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
              <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></Select></Field>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Repeat"><Select value={f.recurrence} onChange={(e) => setF({ ...f, recurrence: e.target.value })}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></Select></Field>
          {f.recurrence !== "none" ? <Field label="Repeat until"><Input type="date" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} /></Field> : <Field label="Remind me at"><Input type="datetime-local" value={f.remind} onChange={(e) => setF({ ...f, remind: e.target.value })} /></Field>}
        </div>
        {f.recurrence !== "none" && <Field label="Remind me at"><Input type="datetime-local" value={f.remind} onChange={(e) => setF({ ...f, remind: e.target.value })} /></Field>}
        {(f.kind === "assignment" || f.kind === "task") && (
          <Field label="Attachment" hint={task?.attachment_path && !file ? "A file is attached. Choose a new one to replace it." : "PDF, image, TXT or DOCX up to 20 MB (stored privately)."}>
            <input type="file" accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-fg" />
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={saving}>{task ? "Save changes" : "Add"}</Button></div>
      </form>
    </Modal>
  );
}

/** Marks a task complete; for repeating tasks, schedules the next occurrence (shifted by the repeat interval). */
export async function completeTask(t: Task) {
  const sb = supabaseBrowser();
  const r = await sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", t.id);
  if (r.error) return r.error.message;
  if (t.recurrence !== "none") {
    const shift = (iso: string | null) => {
      if (!iso) return null;
      const d = new Date(iso);
      if (t.recurrence === "daily") d.setUTCDate(d.getUTCDate() + 1);
      else if (t.recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
      else d.setUTCMonth(d.getUTCMonth() + 1);
      return d.toISOString();
    };
    const nextAnchor = shift(t.start_at ?? t.due_at);
    if (nextAnchor && (!t.recurrence_until || nextAnchor.slice(0, 10) <= t.recurrence_until)) {
      const { id: _id, created_at: _c, completed_at: _d, ...rest } = t;
      void _id; void _c; void _d;
      const e2 = await sb.from("tasks").insert({ ...rest, status: "not_started", start_at: shift(t.start_at), due_at: shift(t.due_at), remind_at: shift(t.remind_at) });
      if (e2.error) return "Completed, but the next repeat couldn't be created: " + e2.error.message;
    }
  }
  return null;
}

// ------------------------------------------------------------------ study session timer → study_logs
export function StudyTimer({ open, onClose, preset, onLogged }: { open: boolean; onClose: () => void; preset?: { subject?: string | null; chapter_id?: string | null; task_id?: string | null; title?: string }; onLogged?: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);
  const startedAt = useRef<string | null>(null);
  useEffect(() => {
    if (open) { setSubject(preset?.subject ?? ""); setChapter(preset?.chapter_id ?? ""); setElapsed(0); setNote(""); setRunning(false); baseRef.current = 0; startedAt.current = null; }
  }, [open, preset]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(baseRef.current + (Date.now() - (startRef.current ?? Date.now())) / 1000), 500);
    return () => clearInterval(id);
  }, [running]);
  const toggle = () => {
    if (running) { baseRef.current = elapsed; setRunning(false); }
    else { startRef.current = Date.now(); startedAt.current ??= new Date().toISOString(); setRunning(true); }
  };
  const finish = async () => {
    const minutes = Math.round(elapsed / 60);
    if (minutes < 1) { toast("Study for at least a minute to log a session.", "info"); return; }
    setSaving(true);
    const sb = supabaseBrowser();
    const r = await sb.from("study_logs").insert({ subject: subject || null, chapter_id: chapter || null, task_id: preset?.task_id ?? null, minutes: Math.min(600, minutes), started_at: startedAt.current ?? new Date().toISOString(), note });
    if (!r.error && preset?.task_id) await sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", preset.task_id);
    setSaving(false);
    if (r.error) { toast(`Not logged: ${r.error.message}`, "error"); return; }
    toast(`Logged ${minutes} minute${minutes === 1 ? "" : "s"} of study. Well done!`);
    onLogged?.();
    onClose();
  };
  const close = () => {
    if (running || elapsed > 60) { if (!confirm("Discard this study session without logging it?")) return; }
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title={preset?.title ? `Study: ${preset.title}` : "Study session"}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject"><Select value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(""); }}><option value="">General</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Chapter"><Select value={chapter} onChange={(e) => setChapter(e.target.value)} disabled={!subject}><option value="">—</option>{CHAPTERS.filter((c) => c.subject === subject).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
        </div>
        <div className="flex flex-col items-center py-4">
          <div className="grid h-40 w-40 place-items-center rounded-full border-4 border-brand/30 bg-brand/5">
            <div className="text-center"><Timer className="mx-auto mb-1 h-5 w-5 text-brand" /><div className="font-mono text-3xl font-semibold tabular-nums">{formatDuration(elapsed)}</div></div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={toggle} variant={running ? "secondary" : "primary"}>{running ? <><Pause className="h-4 w-4" />Pause</> : <><Play className="h-4 w-4" />{elapsed ? "Resume" : "Start"}</>}</Button>
            <Button onClick={finish} variant="outline" disabled={elapsed < 60} loading={saving}><Square className="h-4 w-4" />Finish & log</Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted">Tip: take a 5–10 minute break every 45–60 minutes.</p>
        </div>
        <Field label="Session note (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you cover?" maxLength={500} /></Field>
      </div>
    </Modal>
  );
}
