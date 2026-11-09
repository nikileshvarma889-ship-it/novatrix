"use client";
import { useState } from "react";
import { BookmarkPlus, FileQuestion, HelpCircle, Layers, ListChecks, ScrollText, Send, Sparkles, Square } from "lucide-react";
import { AiLabel, Button, Input } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Markdown } from "@/components/Markdown";
import { FlashcardPreview } from "@/components/FlashcardPreview";
import { readStream } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Action = "summary" | "key_points" | "revision_notes" | "questions" | "ask";
const ACTIONS: { id: Action; label: string; icon: typeof Sparkles }[] = [
  { id: "summary", label: "Summarise", icon: ScrollText },
  { id: "key_points", label: "Key points", icon: ListChecks },
  { id: "revision_notes", label: "Revision notes", icon: Sparkles },
  { id: "questions", label: "Practice questions", icon: FileQuestion },
];

/** AI tools grounded in one of the user's notes or documents. */
export function AiMaterial({ kind, id, title, subject, initialSummary }: { kind: "note" | "document"; id: string; title: string; subject?: string | null; initialSummary?: string | null }) {
  const toast = useToast();
  const { profile } = useProfile();
  const [out, setOut] = useState(initialSummary ?? "");
  const [label, setLabel] = useState(initialSummary ? "Summary" : "");
  const [busy, setBusy] = useState<Action | null>(null);
  const [q, setQ] = useState("");
  const [cards, setCards] = useState(false);
  const [ctrl, setCtrl] = useState<AbortController | null>(null);

  const run = async (action: Action, question?: string) => {
    const c = new AbortController();
    setCtrl(c); setBusy(action); setOut(""); setLabel(action === "ask" ? `Q: ${question}` : ACTIONS.find((a) => a.id === action)!.label);
    try {
      const res = await fetch("/api/ai/material", { method: "POST", signal: c.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id, action, question, language: profile.language_pref }) });
      await readStream(res, setOut);
    } catch (e) { if ((e as Error).name !== "AbortError") { toast(e instanceof Error ? e.message : "AI request failed.", "error"); setOut(""); setLabel(""); } }
    finally { setBusy(null); }
  };
  const saveAsNote = async () => {
    const { error } = await supabaseBrowser().from("notes").insert({ title: `${label} — ${title}`.slice(0, 200), content: `${out}\n\n---\n_AI-generated from “${title}”._`, subject: subject ?? null, tags: ["ai-generated"] });
    if (error) toast(error.message, "error"); else toast("Saved as a new note.");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => <Button key={a.id} size="sm" variant="secondary" onClick={() => run(a.id)} disabled={!!busy} loading={busy === a.id}><a.icon className="h-4 w-4" />{a.label}</Button>)}
        <Button size="sm" variant="secondary" onClick={() => setCards(true)} disabled={!!busy}><Layers className="h-4 w-4" />Flashcards</Button>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) run("ask", q.trim()); }}>
        <div className="relative flex-1"><HelpCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask a question about this ${kind}…`} className="pl-9" /></div>
        <Button type="submit" size="icon" disabled={!q.trim() || !!busy} aria-label="Ask"><Send className="h-4 w-4" /></Button>
      </form>
      {(out || busy) && (
        <div className="card card-pad">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><span className="text-sm font-semibold">{label}</span><AiLabel text={`From your ${kind} only`} /></div>
            {busy ? <Button size="sm" variant="ghost" onClick={() => ctrl?.abort()}><Square className="h-3.5 w-3.5" />Stop</Button> : out && <Button size="sm" variant="ghost" onClick={saveAsNote}><BookmarkPlus className="h-4 w-4" />Save as note</Button>}
          </div>
          {out ? <Markdown className={cn("te", busy && "opacity-90")}>{out}</Markdown> : <p className="text-sm text-muted">Reading your {kind}…</p>}
        </div>
      )}
      <FlashcardPreview open={cards} onClose={() => setCards(false)} request={{ source: kind, id }} subject={subject ?? undefined} deck={title.slice(0, 80)} sourceKind={kind} />
    </div>
  );
}
