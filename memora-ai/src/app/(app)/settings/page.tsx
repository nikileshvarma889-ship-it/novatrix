"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Bell, Camera, Download, GraduationCap, KeyRound, LogOut, Monitor, Moon, Palette, Settings, ShieldAlert, Sun, User } from "lucide-react";
import { Button, Card, CardTitle, Field, Input, PageHeader, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/shell/Avatar";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LANGS, LEVELS, cn } from "@/lib/utils";
import { STYLE_LABELS } from "@/lib/study";
import { TIMEZONES } from "@/lib/dates";

const TABLES = ["memories", "conversations", "notes", "documents", "tasks", "study_logs", "chapter_progress", "flashcards", "quizzes", "quiz_attempts", "videos", "video_notes", "playlists", "notifications"] as const;

export default function SettingsPage() {
  const toast = useToast();
  const router = useRouter();
  const { profile, email, update, avatarUrl, setAvatarUrl } = useProfile();
  const { theme, setTheme } = useTheme();
  const [f, setF] = useState<Profile>(profile);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ a: "", b: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(profile);

  const save = async () => {
    setSaving(true);
    const { error } = await update({ full_name: f.full_name.trim().slice(0, 80), study_level: f.study_level, language_pref: f.language_pref, explanation_style: f.explanation_style, timezone: f.timezone, daily_goal_minutes: f.daily_goal_minutes, exam_name: f.exam_name || null, exam_date: f.exam_date || null, notify_in_app: f.notify_in_app, notify_browser: f.notify_browser });
    setSaving(false);
    if (error) toast(error, "error"); else { toast("Settings saved."); router.refresh(); }
  };
  const pickTheme = async (t: Theme) => { setTheme(t); await update({ theme: t }); };
  const avatar = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) return toast("Use a PNG, JPG or WebP image under 2 MB.", "error");
    const sb = supabaseBrowser();
    const path = `${profile.id}/avatar/${Date.now()}.${file.type.split("/")[1]}`;
    const up = await sb.storage.from("user-files").upload(path, file, { contentType: file.type, upsert: true });
    if (up.error) return toast(up.error.message, "error");
    if (profile.avatar_path) await sb.storage.from("user-files").remove([profile.avatar_path]);
    const { error } = await update({ avatar_path: path });
    if (error) return toast(error, "error");
    const { data } = await sb.storage.from("user-files").createSignedUrl(path, 60 * 60 * 6);
    setAvatarUrl(data?.signedUrl ?? null);
    toast("Profile photo updated.");
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.a.length < 8 || !/[A-Za-z]/.test(pw.a) || !/\d/.test(pw.a)) return toast("Use at least 8 characters with letters and numbers.", "error");
    if (pw.a !== pw.b) return toast("The passwords don't match.", "error");
    setPwBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw.a });
    setPwBusy(false);
    if (error) toast(error.message, "error"); else { toast("Password changed."); setPw({ a: "", b: "" }); }
  };
  const exportData = async () => {
    setExporting(true);
    const sb = supabaseBrowser();
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), profile };
    for (const t of TABLES) out[t] = (await sb.from(t).select("*")).data ?? [];
    out.messages = (await sb.from("messages").select("*")).data ?? [];
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `memora-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(a.href);
    setExporting(false);
  };
  const wipe = async () => {
    if (prompt('This permanently deletes ALL your memories, chats, notes, documents, tasks, flashcards, quizzes and videos. Type DELETE to confirm.') !== "DELETE") return;
    const sb = supabaseBrowser();
    const { data: files } = await sb.from("documents").select("file_path");
    const { data: att } = await sb.from("tasks").select("attachment_path").not("attachment_path", "is", null);
    const paths = [...(files ?? []).map((x) => x.file_path), ...(att ?? []).map((x) => x.attachment_path as string)];
    for (let i = 0; i < paths.length; i += 100) await sb.storage.from("user-files").remove(paths.slice(i, i + 100));
    for (const t of [...TABLES].reverse()) { const { error } = await sb.from(t).delete().not("user_id", "is", null); if (error) return toast(`Stopped at ${t}: ${error.message}`, "error"); }
    toast("All your data has been deleted.");
    router.replace("/dashboard"); router.refresh();
  };
  const signOut = async () => { await supabaseBrowser().auth.signOut(); router.replace("/login"); router.refresh(); };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" sub="Your profile, study preferences and privacy" icon={<Settings className="h-5 w-5" />} actions={<Button onClick={save} disabled={!dirty} loading={saving}>Save changes</Button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<User className="h-4 w-4" />} title="Profile" />
          <div className="mb-5 flex items-center gap-4">
            <div className="relative"><Avatar name={f.full_name} email={email} url={avatarUrl} size={72} /><button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 rounded-full bg-brand p-1.5 text-white shadow" aria-label="Change photo"><Camera className="h-3.5 w-3.5" /></button></div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => avatar(e.target.files?.[0])} />
            <div><div className="font-semibold">{f.full_name || "Student"}</div><div className="text-sm text-muted">{email}</div></div>
          </div>
          <Field label="Full name"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} maxLength={80} /></Field>
        </Card>

        <Card>
          <CardTitle icon={<GraduationCap className="h-4 w-4" />} title="Study preferences" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Level"><Select value={f.study_level} onChange={(e) => setF({ ...f, study_level: e.target.value as Profile["study_level"] })}>{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
            <Field label="AI answer language"><Select value={f.language_pref} onChange={(e) => setF({ ...f, language_pref: e.target.value as Profile["language_pref"] })}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
            <Field label="Default explanation style"><Select value={f.explanation_style} onChange={(e) => setF({ ...f, explanation_style: e.target.value })}>{Object.entries(STYLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <Field label="Daily study goal (minutes)"><Input type="number" min={0} max={960} value={f.daily_goal_minutes} onChange={(e) => setF({ ...f, daily_goal_minutes: Math.max(0, Math.min(960, +e.target.value)) })} /></Field>
            <Field label="Exam name"><Input value={f.exam_name ?? ""} onChange={(e) => setF({ ...f, exam_name: e.target.value })} placeholder="e.g. AP EAPCET 2027" /></Field>
            <Field label="Exam date"><Input type="date" value={f.exam_date ?? ""} onChange={(e) => setF({ ...f, exam_date: e.target.value || null })} /></Field>
          </div>
        </Card>

        <Card>
          <CardTitle icon={<Palette className="h-4 w-4" />} title="Appearance & region" />
          <span className="label">Theme</span>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {([["dark", "Dark", Moon], ["light", "Light", Sun], ["system", "System", Monitor]] as const).map(([id, l, I]) => (
              <button key={id} onClick={() => pickTheme(id)} className={cn("flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm", theme === id ? "border-brand/60 bg-brand/10 text-brand" : "border-border text-muted hover:text-fg")}><I className="h-5 w-5" />{l}</button>
            ))}
          </div>
          <Field label="Timezone" hint="Used for your timetable, reminders and “today”. Default: Asia/Kolkata."><Select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{Array.from(new Set([f.timezone, ...TIMEZONES])).map((t) => <option key={t}>{t}</option>)}</Select></Field>
        </Card>

        <Card>
          <CardTitle icon={<Bell className="h-4 w-4" />} title="Notifications" />
          <Toggle label="In-app notifications" sub="Reminders, deadlines, revision and exam countdown in the notification centre." on={f.notify_in_app} set={(v) => setF({ ...f, notify_in_app: v })} />
          <Toggle label="Browser pop-up alerts" sub="System notifications while MEMORA is open. Requires browser permission." on={f.notify_browser} set={async (v) => { if (v && "Notification" in window && Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return toast("Permission not granted.", "info"); setF({ ...f, notify_browser: v }); }} />
        </Card>

        <Card>
          <CardTitle icon={<KeyRound className="h-4 w-4" />} title="Security" />
          <form onSubmit={changePw} className="space-y-3">
            <Field label="New password"><Input type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
            <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
            <div className="flex justify-between gap-2"><Button type="submit" variant="secondary" loading={pwBusy} disabled={!pw.a}>Change password</Button><Button type="button" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" />Log out</Button></div>
          </form>
        </Card>

        <Card className="border-danger/25">
          <CardTitle icon={<ShieldAlert className="h-4 w-4" />} title="Your data" sub="Your data is private to your account (row-level security)." />
          <div className="space-y-3">
            <Button variant="secondary" onClick={exportData} loading={exporting}><Download className="h-4 w-4" />Export all my data (JSON)</Button>
            <div className="rounded-xl border border-danger/30 p-3">
              <div className="text-sm font-medium text-danger">Delete all my data</div>
              <p className="mt-0.5 text-xs text-muted">Removes every memory, chat, note, document, task, flashcard, quiz and video from your account. Your login stays active.</p>
              <Button variant="danger" size="sm" className="mt-3" onClick={wipe}>Delete everything</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Toggle({ label, sub, on, set }: { label: string; sub: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-3 last:border-0">
      <div><div className="text-sm font-medium">{label}</div><div className="text-xs text-muted">{sub}</div></div>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-brand" : "bg-surface-2 ring-1 ring-border")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}
