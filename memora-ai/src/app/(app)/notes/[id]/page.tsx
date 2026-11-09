"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bold, Check, Code, Eye, Heading2, Heart, Italic, Link2, List, ListOrdered, Loader2, Pencil, Pin, Quote, Sigma, Sparkles, Trash2 } from "lucide-react";
import { Button, Card, Input, Select, Skeleton, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Markdown } from "@/components/Markdown";
import { AiMaterial } from "@/components/AiMaterial";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SUBJECTS, cn } from "@/lib/utils";
import { relative } from "@/lib/dates";

type Note = { id: string; title: string; content: string; subject: string | null; tags: string[]; pinned: boolean; favourite: boolean; updated_at: string };

/** Rich-text (Markdown) note editor with toolbar, live preview, autosave and AI tools. */
export default function NoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState<Note | null>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [tags, setTags] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creating = useRef(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (id === "new") {
      if (creating.current) return;
      creating.current = true;
      sb.from("notes").insert({ title: "Untitled note" }).select("*").single().then(({ data, error }) => {
        if (error || !data) { toast(`Couldn't create the note: ${error?.message}`, "error"); router.replace("/notes"); return; }
        router.replace(`/notes/${data.id}`);
      });
      return;
    }
    sb.from("notes").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) { toast("Note not found.", "error"); router.replace("/notes"); return; }
      setNote(data as Note); setTags((data as Note).tags.join(", ")); setMode((data as Note).content ? "preview" : "write");
    });
  }, [id, router, toast]);

  const persist = useCallback(async (n: Note) => {
    setSaveState("saving");
    const { error } = await supabaseBrowser().from("notes").update({ title: n.title.trim() || "Untitled note", content: n.content, subject: n.subject, tags: n.tags, pinned: n.pinned, favourite: n.favourite }).eq("id", n.id);
    setSaveState(error ? "error" : "saved");
    if (error) toast(`Not saved: ${error.message}`, "error");
  }, [toast]);

  const change = (p: Partial<Note>, immediate = false) => {
    if (!note) return;
    const n = { ...note, ...p };
    setNote(n); setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(n), immediate ? 0 : 900);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (saveState === "dirty" || saveState === "saving") { e.preventDefault(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const wrap = (before: string, after = before, placeholder = "text") => {
    const el = ta.current; if (!el || !note) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    change({ content: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  const linePrefix = (prefix: string) => {
    const el = ta.current; if (!el || !note) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const block = value.slice(start, e).split("\n").map((l, i) => (prefix === "1. " ? `${i + 1}. ` : prefix) + l).join("\n");
    change({ content: value.slice(0, start) + block + value.slice(e) });
    requestAnimationFrame(() => el.focus());
  };
  const del = async () => {
    if (!note || !confirm("Delete this note permanently?")) return;
    const { error } = await supabaseBrowser().from("notes").delete().eq("id", note.id);
    if (error) return toast(error.message, "error");
    toast("Note deleted."); router.replace("/notes");
  };

  if (!note) return <div className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-96" /></div>;
  const tools: [typeof Bold, string, () => void][] = [
    [Bold, "Bold", () => wrap("**")], [Italic, "Italic", () => wrap("_")], [Heading2, "Heading", () => linePrefix("## ")], [List, "Bullet list", () => linePrefix("- ")],
    [ListOrdered, "Numbered list", () => linePrefix("1. ")], [Quote, "Quote", () => linePrefix("> ")], [Code, "Code", () => wrap("`")], [Sigma, "Math (LaTeX)", () => wrap("$", "$", "x^2")], [Link2, "Link", () => wrap("[", "](https://)", "link text")],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/notes" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Notes</Link>
        <div className="flex items-center gap-1.5">
          <span className="mr-2 text-xs text-subtle" aria-live="polite">{saveState === "saving" ? <><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Saving…</> : saveState === "dirty" ? "Unsaved changes" : saveState === "error" ? <span className="text-danger">Not saved</span> : <><Check className="mr-1 inline h-3 w-3 text-ok" />Saved · {relative(note.updated_at)}</>}</span>
          <Button size="icon" variant="ghost" onClick={() => change({ pinned: !note.pinned }, true)} aria-label={note.pinned ? "Unpin" : "Pin"} title="Pin"><Pin className={cn("h-4 w-4", note.pinned && "fill-brand text-brand")} /></Button>
          <Button size="icon" variant="ghost" onClick={() => change({ favourite: !note.favourite }, true)} aria-label="Favourite" title="Favourite"><Heart className={cn("h-4 w-4", note.favourite && "fill-danger text-danger")} /></Button>
          <Button size="icon" variant="ghost" onClick={del} aria-label="Delete note" title="Delete"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <input value={note.title} onChange={(e) => change({ title: e.target.value.slice(0, 200) })} className="te w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-subtle sm:text-3xl" placeholder="Note title" aria-label="Title" />
      <div className="flex flex-wrap gap-2">
        <Select value={note.subject ?? ""} onChange={(e) => change({ subject: e.target.value || null }, true)} className="w-44"><option value="">No subject</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} onBlur={() => change({ tags: tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 15) }, true)} placeholder="tags, comma separated" className="w-64" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <Tabs tabs={[{ id: "write", label: <span className="flex items-center gap-1"><Pencil className="h-3.5 w-3.5" />Write</span> }, { id: "preview", label: <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />Preview</span> }]} value={mode} onChange={setMode} />
            {mode === "write" && <div className="flex flex-wrap gap-0.5">{tools.map(([I, l, f]) => <button key={l} onClick={f} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label={l} title={l}><I className="h-4 w-4" /></button>)}</div>}
          </div>
          {mode === "write" ? (
            <textarea ref={ta} value={note.content} onChange={(e) => change({ content: e.target.value })} placeholder={"Start writing…\n\nTip: use **bold**, ## headings, - lists and $E = mc^2$ for formulas."}
              className="te min-h-[60vh] w-full resize-y bg-transparent p-5 font-mono text-[14px] leading-7 outline-none placeholder:text-subtle" aria-label="Note content" />
          ) : (
            <div className="min-h-[60vh] p-5">{note.content ? <Markdown className="te">{note.content}</Markdown> : <p className="text-sm text-muted">Nothing written yet.</p>}</div>
          )}
        </Card>
        <Card className="h-fit">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-brand" />AI study tools</h2>
          {note.content.trim().length < 40 ? <p className="text-sm text-muted">Write a little more (at least a few sentences) to use AI summaries, revision notes, questions and flashcards.</p> : (
            <AiMaterial kind="note" id={note.id} title={note.title} subject={note.subject} />
          )}
        </Card>
      </div>
    </div>
  );
}
