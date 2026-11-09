"use client";
import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Wand2, Brain, CheckSquare, BellRing } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { supabaseBrowser } from "@/lib/supabase/client";
import { MEMORY_CATEGORIES, cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { fromLocalInput, toLocalInput } from "@/lib/dates";

type Kind = "memory" | "task" | "reminder";
type Draft = { kind: Kind; title: string; content: string; category: string; due: string; remind: string; priority: string; subject: string };

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib everywhere).
type SR = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const getSR = (): (new () => SR) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Voice (or typed) capture → editable transcript → AI suggests memory / task / reminder → user reviews → saved only on confirmation. */
export function VoiceCapture({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const toast = useToast();
  const { profile } = useProfile();
  const tz = profile.timezone;
  const [lang, setLang] = useState<"en-IN" | "te-IN">(profile.language_pref === "te" ? "te-IN" : "en-IN");
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const rec = useRef<SR | null>(null);
  const supported = typeof window !== "undefined" && !!getSR();

  useEffect(() => {
    if (!open) { rec.current?.stop(); setListening(false); setText(""); setInterim(""); setDraft(null); setMicError(null); }
  }, [open]);

  const start = () => {
    const C = getSR();
    if (!C) { setMicError("Voice input isn't supported in this browser. Please type instead."); return; }
    const r = new C();
    r.lang = lang; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let fin = "", int = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t; else int += t;
      }
      if (fin) setText((x) => (x ? x.trimEnd() + " " : "") + fin.trim());
      setInterim(int);
    };
    r.onerror = (e) => {
      setMicError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone permission was denied. You can type your memory below instead." : e.error === "no-speech" ? "No speech was detected. Try again or type below." : `Voice input stopped (${e.error}). You can type instead.`);
      setListening(false);
    };
    r.onend = () => { setListening(false); setInterim(""); };
    rec.current = r;
    setMicError(null);
    try { r.start(); setListening(true); } catch { setMicError("Couldn't start the microphone. Please type instead."); }
  };
  const stop = () => { rec.current?.stop(); setListening(false); };

  const analyse = async () => {
    if (!text.trim()) return;
    setAnalysing(true);
    try {
      const res = await fetch("/api/ai/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, timezone: tz, now: new Date().toISOString() }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setDraft({ kind: j.kind, title: j.title, content: j.content || text, category: j.category || "General Notes", due: toLocalInput(j.due_at, tz), remind: toLocalInput(j.remind_at, tz), priority: j.priority || "medium", subject: j.subject || "" });
    } catch (e) {
      toast(`${e instanceof Error ? e.message : "AI analysis failed"} — you can fill in the details yourself.`, "error");
      setDraft({ kind: "memory", title: text.slice(0, 80), content: text, category: "General Notes", due: "", remind: "", priority: "medium", subject: "" });
    } finally { setAnalysing(false); }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { toast("Please add a title.", "error"); return; }
    setSaving(true);
    const sb = supabaseBrowser();
    let error;
    if (draft.kind === "memory") {
      ({ error } = await sb.from("memories").insert({ title: draft.title.trim(), content: draft.content.trim(), category: draft.category, priority: draft.priority, source: "voice" }));
    } else {
      const due = fromLocalInput(draft.due, tz), remind = fromLocalInput(draft.remind, tz);
      ({ error } = await sb.from("tasks").insert({ kind: draft.kind === "reminder" ? "reminder" : "task", title: draft.title.trim(), description: draft.content.trim(), due_at: due, remind_at: remind ?? (draft.kind === "reminder" ? due : null), priority: draft.priority, subject: draft.subject || null }));
    }
    setSaving(false);
    if (error) { toast(`Not saved: ${error.message}`, "error"); return; }
    toast(draft.kind === "memory" ? "Memory saved." : draft.kind === "reminder" ? "Reminder created." : "Task created.");
    onSaved?.();
    onClose();
  };

  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <Modal open={open} onClose={onClose} title="Voice memory assistant">
      {!draft ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">Speak naturally — e.g. “Remember that I have a Chemistry test next Monday.”</p>
            <Select value={lang} onChange={(e) => setLang(e.target.value as "en-IN" | "te-IN")} className="w-36 shrink-0" aria-label="Voice language" disabled={listening}>
              <option value="en-IN">English</option>
              <option value="te-IN">తెలుగు Telugu</option>
            </Select>
          </div>
          <div className="flex flex-col items-center py-2">
            <button onClick={listening ? stop : start} disabled={!supported}
              className={cn("relative grid h-20 w-20 place-items-center rounded-full text-white transition", listening ? "bg-danger" : "bg-brand-grad shadow-glow", !supported && "opacity-40")}
              aria-label={listening ? "Stop listening" : "Start listening"}>
              {listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" />}
              {listening ? <MicOff className="relative h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </button>
            <div className="mt-2 text-xs text-muted">{!supported ? "Voice input not supported here — type below." : listening ? "Listening… tap to stop" : "Tap to speak"}</div>
          </div>
          {micError && <div className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">{micError}</div>}
          <Field label="Recognised text (you can edit it)">
            <Textarea value={text + (interim ? (text ? " " : "") + interim : "")} onChange={(e) => { setText(e.target.value); setInterim(""); }} placeholder="Your words appear here. You can also type." className="te min-h-[110px]" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={analyse} loading={analysing} disabled={!text.trim() || listening}><Wand2 className="h-4 w-4" />Review</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted">Nothing is saved until you confirm. Check the details below. <Badge tone="brand">AI suggestion</Badge></div>
          <div className="grid grid-cols-3 gap-2">
            {([["memory", "Memory", Brain], ["task", "Task", CheckSquare], ["reminder", "Reminder", BellRing]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => set({ kind: k })} className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm", draft.kind === k ? "border-brand/50 bg-brand/10 text-brand" : "border-border text-muted hover:text-fg")}>
                <I className="h-4 w-4" />{l}
              </button>
            ))}
          </div>
          <Field label="Title"><Input value={draft.title} onChange={(e) => set({ title: e.target.value })} className="te" /></Field>
          <Field label="Details"><Textarea value={draft.content} onChange={(e) => set({ content: e.target.value })} className="te" /></Field>
          {draft.kind === "memory" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category"><Select value={draft.category} onChange={(e) => set({ category: e.target.value })}>{MEMORY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Priority"><Select value={draft.priority} onChange={(e) => set({ priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label={draft.kind === "reminder" ? "Date & time" : "Due"}><Input type="datetime-local" value={draft.due} onChange={(e) => set({ due: e.target.value })} /></Field>
              <Field label="Remind me at"><Input type="datetime-local" value={draft.remind} onChange={(e) => set({ remind: e.target.value })} /></Field>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>Back</Button>
            <Button onClick={save} loading={saving}>Confirm & save</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
