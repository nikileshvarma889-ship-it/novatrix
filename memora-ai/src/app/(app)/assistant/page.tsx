"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, Check, Copy, Eraser, MessageSquarePlus, MoreHorizontal, NotebookPen, PanelLeft, Pencil, RefreshCw, Send, Sparkles, CalendarClock, Trash2, X } from "lucide-react";
import { Button, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Markdown } from "@/components/Markdown";
import { MemoryEditor, type Memory } from "@/components/editors";
import { LogoMark } from "@/components/shell/Logo";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { readStream } from "@/hooks/useData";
import { fmtTime, relative } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Conv = { id: string; title: string; updated_at: string };
type Source = { kind: "memory" | "note" | "task"; id: string; ref: string; title: string };
type Msg = { id: string; role: "user" | "assistant"; content: string; created_at: string; sources?: Source[]; pending?: boolean; saveIntent?: boolean };

const SUGGESTIONS = [
  "What was my Physics assignment?",
  "Explain Newton's second law with an example, in English and Telugu",
  "Make a 7-day revision plan for Chemistry",
  "What do I have due this week?",
  "Solve: a car accelerates from 10 m/s to 30 m/s in 5 s. Find acceleration and distance.",
  "Remember that I prefer explanations in English and Telugu",
];

function AssistantInner() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { profile } = useProfile();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string | null>(params.get("c"));
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState(profile.language_pref);
  const [sideOpen, setSideOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [saveDraft, setSaveDraft] = useState<Partial<Memory> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef(false);

  const loadConvs = useCallback(async () => {
    const { data } = await supabaseBrowser().from("conversations").select("id,title,updated_at").order("updated_at", { ascending: false }).limit(100);
    setConvs(data ?? []);
  }, []);
  useEffect(() => { loadConvs(); }, [loadConvs]);

  useEffect(() => {
    if (!convId) { setMsgs([]); return; }
    if (busy) return;
    setLoadingMsgs(true);
    supabaseBrowser().from("messages").select("id,role,content,created_at,sources").eq("conversation_id", convId).order("created_at").then(({ data, error }) => {
      setLoadingMsgs(false);
      if (error) toast(error.message, "error");
      setMsgs((data ?? []) as Msg[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const prepareSave = useCallback(async (text: string) => {
    try {
      const r = await fetch("/api/ai/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, timezone: profile.timezone }) });
      const j = await r.json();
      setSaveDraft({ title: j.title ?? text.slice(0, 80), content: j.content ?? text, category: j.category ?? "General Notes", priority: j.priority ?? "medium", source: "chat" });
    } catch {
      setSaveDraft({ title: text.replace(/^(please\s+)?(remember|save)( that)?\s*/i, "").slice(0, 80), content: text, source: "chat" });
    }
  }, [profile.timezone]);

  const send = useCallback(async (text?: string, regenerate = false) => {
    const message = (text ?? input).trim();
    if ((!message && !regenerate) || busy) return;
    setBusy(true);
    setInput("");
    const now = new Date().toISOString();
    setMsgs((m) => {
      let base = m;
      if (regenerate) { const i = base.map((x) => x.role).lastIndexOf("assistant"); if (i >= 0) base = base.slice(0, i); }
      else base = [...base, { id: "u" + now, role: "user", content: message, created_at: now }];
      return [...base, { id: "a" + now, role: "assistant", content: "", created_at: now, pending: true }];
    });
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: convId, message: regenerate ? undefined : message, regenerate, language: lang, timezone: profile.timezone }) });
      const newId = res.headers.get("x-conversation-id");
      const sources: Source[] = JSON.parse(decodeURIComponent(res.headers.get("x-sources") ?? "%5B%5D"));
      const saveIntent = res.headers.get("x-save-intent") === "1";
      if (newId && newId !== convId) { setConvId(newId); router.replace(`/assistant?c=${newId}`); }
      const full = await readStream(res, (t) => setMsgs((m) => m.map((x) => (x.pending ? { ...x, content: t } : x))));
      setMsgs((m) => m.map((x) => (x.pending ? { ...x, pending: false, content: full, sources: sources.filter((s) => full.includes(`[${s.ref}]`)), saveIntent } : x)));
      if (saveIntent && !regenerate) prepareSave(message);
      loadConvs();
    } catch (e) {
      setMsgs((m) => m.filter((x) => !x.pending));
      toast(e instanceof Error ? e.message : "The assistant couldn't answer.", "error");
      if (!regenerate) setInput(message);
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }, [input, busy, convId, lang, profile.timezone, router, loadConvs, toast, prepareSave]);

  // ?q= from the dashboard search bar
  useEffect(() => {
    const q = params.get("q");
    if (q && !sentInitial.current) { sentInitial.current = true; setConvId(null); router.replace("/assistant"); setTimeout(() => send(q), 50); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const newChat = () => { setConvId(null); setMsgs([]); router.replace("/assistant"); setSideOpen(false); taRef.current?.focus(); };
  const del = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    const { error } = await supabaseBrowser().from("conversations").delete().eq("id", id);
    if (error) return toast(error.message, "error");
    setConvs((c) => c.filter((x) => x.id !== id));
    if (id === convId) newChat();
  };
  const rename = async (id: string) => {
    const title = renameText.trim().slice(0, 120);
    setRenaming(null);
    if (!title) return;
    const { error } = await supabaseBrowser().from("conversations").update({ title }).eq("id", id);
    if (error) return toast(error.message, "error");
    setConvs((c) => c.map((x) => (x.id === id ? { ...x, title } : x)));
  };
  const clear = async () => {
    if (!convId || !confirm("Clear all messages in this conversation?")) return;
    const { error } = await supabaseBrowser().from("messages").delete().eq("conversation_id", convId);
    if (error) return toast(error.message, "error");
    setMsgs([]);
  };
  const copy = async (m: Msg) => { await navigator.clipboard.writeText(m.content); setCopied(m.id); setTimeout(() => setCopied(null), 1500); };
  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");

  const ConvList = (
    <div className="flex h-full flex-col">
      <Button onClick={newChat} className="mb-3 w-full"><MessageSquarePlus className="h-4 w-4" />New conversation</Button>
      <div className="scrollbar-thin -mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
        {convs.length === 0 && <p className="px-2 py-4 text-xs text-muted">Your conversations will appear here.</p>}
        {convs.map((c) => (
          <div key={c.id} className={cn("group flex items-center gap-1 rounded-lg pr-1", c.id === convId ? "bg-brand/10" : "hover:bg-surface-2")}>
            {renaming === c.id ? (
              <form className="flex-1 p-1" onSubmit={(e) => { e.preventDefault(); rename(c.id); }}><input autoFocus value={renameText} onChange={(e) => setRenameText(e.target.value)} onBlur={() => rename(c.id)} className="input h-8 py-1 text-[13px]" /></form>
            ) : (
              <button onClick={() => { setConvId(c.id); router.replace(`/assistant?c=${c.id}`); setSideOpen(false); }} className="min-w-0 flex-1 px-3 py-2 text-left">
                <div className={cn("truncate text-[13px]", c.id === convId ? "font-medium text-fg" : "text-muted")}>{c.title}</div>
                <div className="text-[10.5px] text-subtle">{relative(c.updated_at)}</div>
              </button>
            )}
            <div className="flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <button onClick={() => { setRenaming(c.id); setRenameText(c.title); }} className="rounded p-1 text-subtle hover:text-fg" aria-label="Rename"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => del(c.id)} className="rounded p-1 text-subtle hover:text-danger" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="-mt-1 flex h-[calc(100dvh-8.5rem)] gap-4 lg:h-[calc(100dvh-6.5rem)]">
      <aside className="card hidden w-64 shrink-0 p-3 md:block">{ConvList}</aside>
      <AnimatePresence>
        {sideOpen && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSideOpen(false)}>
            <motion.div className="card absolute inset-y-0 left-0 w-72 rounded-l-none p-3" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex justify-end"><button onClick={() => setSideOpen(false)} className="p-1 text-muted" aria-label="Close"><X className="h-5 w-5" /></button></div>
              {ConvList}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="card flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        <header className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5 sm:px-4">
          <button onClick={() => setSideOpen(true)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 md:hidden" aria-label="Conversations"><PanelLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">{convs.find((c) => c.id === convId)?.title ?? "New conversation"}</div>
          <Select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} className="h-8 w-[132px] py-1 text-xs" aria-label="Answer language"><option value="en">English</option><option value="te">తెలుగు</option><option value="en_te">English + తెలుగు</option></Select>
          {convId && <button onClick={clear} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" title="Clear conversation" aria-label="Clear conversation"><Eraser className="h-4 w-4" /></button>}
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-5 sm:px-6">
          {loadingMsgs ? <div className="grid h-full place-items-center"><Spinner /></div> : msgs.length === 0 ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
              <LogoMark size={56} className="drop-shadow-[0_10px_30px_rgba(124,92,255,0.5)]" />
              <h2 className="mt-5 text-xl font-semibold">How can I help you today?</h2>
              <p className="mt-1.5 max-w-md text-sm text-muted">Ask about your saved memories, your schedule, or any Maths, Physics or Chemistry concept. I answer from your own data and tell you when something isn&apos;t saved.</p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-xl border border-border/70 bg-surface-2/40 px-4 py-3 text-left text-[13px] text-muted transition hover:border-brand/40 hover:text-fg">{s}</button>)}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {msgs.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
                  {m.role === "assistant" && <LogoMark size={30} className="mt-0.5 shrink-0" />}
                  <div className={cn("min-w-0", m.role === "user" ? "max-w-[85%]" : "flex-1")}>
                    <div className={cn(m.role === "user" ? "te rounded-2xl rounded-tr-md bg-brand-grad px-4 py-2.5 text-[15px] text-white" : "")}>
                      {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : m.pending && !m.content ? <Typing /> : <Markdown className="te">{m.content}</Markdown>}
                    </div>
                    {m.role === "assistant" && !m.pending && m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="text-[11px] text-subtle">From your saved data:</span>
                        {m.sources.map((s) => (
                          <Link key={s.ref} href={s.kind === "memory" ? `/memories?open=${s.id}` : s.kind === "note" ? `/notes/${s.id}` : "/planner"} className="chip hover:border-brand/40 hover:text-fg">
                            {s.kind === "memory" ? <Brain className="h-3 w-3" /> : s.kind === "note" ? <NotebookPen className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}[{s.ref}] {s.title}
                          </Link>
                        ))}
                      </div>
                    )}
                    <div className={cn("mt-1.5 flex items-center gap-1 text-[11px] text-subtle", m.role === "user" && "justify-end")}>
                      <span>{fmtTime(m.created_at, profile.timezone)}</span>
                      {m.role === "assistant" && !m.pending && (
                        <>
                          <button onClick={() => copy(m)} className="rounded p-1 hover:bg-surface-2 hover:text-fg" aria-label="Copy">{copied === m.id ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}</button>
                          {m.id === lastAssistant?.id && <button onClick={() => send(undefined, true)} disabled={busy} className="rounded p-1 hover:bg-surface-2 hover:text-fg" aria-label="Regenerate" title="Regenerate"><RefreshCw className="h-3.5 w-3.5" /></button>}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              {saveDraft && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-10 rounded-2xl border border-brand/30 bg-brand/5 p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand"><Brain className="h-4 w-4" />Save as memory? — not saved yet</div>
                  <div className="te text-sm font-medium">{saveDraft.title}</div>
                  <div className="te mt-0.5 text-sm text-muted">{saveDraft.content}</div>
                  <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => setEditorOpen(true)}>Review & confirm</Button><Button size="sm" variant="ghost" onClick={() => setSaveDraft(null)}>Dismiss</Button></div>
                </motion.div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-border/60 p-3 sm:p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-surface-2/60 p-2 focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/15">
            <textarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1} placeholder="Message MEMORA… (Shift+Enter for a new line)" className="te max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-subtle" aria-label="Message" />
            <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Send">{busy ? <Spinner className="h-4 w-4 text-white" /> : <Send className="h-4 w-4" />}</Button>
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-[10.5px] text-subtle"><Sparkles className="mr-1 inline h-3 w-3" />AI can make mistakes — check important facts. MEMORA only sees your own data.</p>
        </form>
      </section>
      <MemoryEditor open={editorOpen && !!saveDraft} initial={saveDraft ?? undefined} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); setSaveDraft(null); }} />
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-1 py-2" aria-label="MEMORA is typing">
      {[0, 1, 2].map((i) => <motion.span key={i} className="h-2 w-2 rounded-full bg-brand" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />)}
    </div>
  );
}

export default function AssistantPage() {
  return <Suspense fallback={<div className="grid h-64 place-items-center"><MoreHorizontal className="h-6 w-6 animate-pulse text-muted" /></div>}><AssistantInner /></Suspense>;
}
