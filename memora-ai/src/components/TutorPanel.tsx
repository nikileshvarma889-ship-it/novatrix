"use client";
import { useRef, useState } from "react";
import { BookmarkPlus, Camera, Copy, NotebookPen, Printer, Sparkles, Square, Wand2 } from "lucide-react";
import { AiLabel, Button, Field, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Markdown } from "@/components/Markdown";
import { readStream, postJson } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { supabaseBrowser } from "@/lib/supabase/client";
import { STYLE_LABELS, type StyleId } from "@/lib/study";
import { CHAPTERS } from "@/lib/syllabus";
import { cn, subjectName } from "@/lib/utils";

/** AI tutor: language + style + optional notebook-format answers; photo-of-question with editable recognition; print & save. */
export function TutorPanel({ subject, chapterId, onChapter, allowImage = true, placeholder, initialQuestion, initialStyle }: { subject: "mathematics" | "physics" | "chemistry" | "general"; chapterId?: string | null; onChapter?: (id: string) => void; allowImage?: boolean; placeholder?: string; initialQuestion?: string; initialStyle?: StyleId }) {
  const toast = useToast();
  const { profile } = useProfile();
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [lang, setLang] = useState(profile.language_pref);
  const [style, setStyle] = useState<StyleId>(initialStyle ?? "steps");
  const [notebook, setNotebook] = useState(subject !== "general");
  const [answer, setAnswer] = useState("");
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [recognised, setRecognised] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ask = async () => {
    if (question.trim().length < 2 || busy) return;
    setBusy(true); setAnswer(""); setAsked(question.trim());
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/ai/tutor", { method: "POST", signal: abort.current.signal, headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, chapterId: chapterId || null, question: question.trim(), language: lang, style, notebook, level: profile.study_level }) });
      await readStream(res, setAnswer);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast(e instanceof Error ? e.message : "The tutor couldn't answer.", "error");
    } finally { setBusy(false); }
  };

  const onImage = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast("Please use an image under 5 MB.", "error"); return; }
    setOcrBusy(true);
    try {
      const dataUrl = await downscale(file);
      const { text } = await postJson<{ text: string }>("/api/ai/ocr", { image: dataUrl });
      setQuestion(text); setRecognised(true);
      toast("Question recognised — please check and correct it before solving.", "info");
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't read the image.", "error"); }
    finally { setOcrBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const saveNote = async () => {
    const { error } = await supabaseBrowser().from("notes").insert({ title: asked.slice(0, 100), content: `**Question:** ${asked}\n\n${answer}\n\n---\n_AI tutor answer (${STYLE_LABELS[style]}), saved from MEMORA Study Centre._`, subject: subject === "general" ? null : subject, tags: ["ai-tutor"] }).select("id").single();
    if (error) toast(`Not saved: ${error.message}`, "error"); else toast("Saved to your notes.", "ok");
  };

  const print = () => {
    const w = window.open("", "_blank", "width=900,height=1000");
    const el = document.getElementById("tutor-answer");
    if (!w || !el) return;
    const css = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.outerHTML).join("");
    w.document.write(`<!doctype html><html><head><title>${asked.slice(0, 60)} — MEMORA AI</title>${css}<style>body{background:#fff!important;padding:24px}</style></head><body class="font-sans"><div class="notebook">${el.innerHTML}</div><p style="font:12px sans-serif;color:#666;margin-top:12px">AI-generated answer from MEMORA AI — verify with your textbook.</p></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  const chapters = subject === "general" ? [] : CHAPTERS.filter((c) => c.subject === subject);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {onChapter && chapters.length > 0 && (
          <Field label="Chapter" className="sm:col-span-3"><Select value={chapterId ?? ""} onChange={(e) => onChapter(e.target.value)}><option value="">Any chapter</option>{chapters.map((c) => <option key={c.id} value={c.id}>{c.paper} · {c.title}</option>)}</Select></Field>
        )}
        <Field label="Language"><Select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}><option value="en">English</option><option value="te">Telugu (తెలుగు)</option><option value="en_te">English + Telugu</option></Select></Field>
        <Field label="Explanation style"><Select value={style} onChange={(e) => setStyle(e.target.value as StyleId)}>{Object.entries(STYLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Format">
          <button type="button" onClick={() => setNotebook((n) => !n)} className={cn("input flex items-center justify-between text-left", notebook && "border-brand/50 bg-brand/10")} aria-pressed={notebook}>
            <span className="flex items-center gap-2"><NotebookPen className="h-4 w-4" />Notebook-style</span><span className={cn("text-xs", notebook ? "text-brand" : "text-subtle")}>{notebook ? "On" : "Off"}</span>
          </button>
        </Field>
      </div>
      <Field label={recognised ? "Recognised question — check it, then solve" : "Your question"}>
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask(); }}
          placeholder={placeholder ?? `Ask anything in ${subjectName(subject === "general" ? null : subject)} — a concept, a formula, or a full problem with values.`} className={cn("te min-h-[110px]", recognised && "border-warn/50")} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        {busy ? <Button variant="secondary" onClick={() => abort.current?.abort()}><Square className="h-4 w-4" />Stop</Button> : <Button onClick={ask} disabled={question.trim().length < 2}><Wand2 className="h-4 w-4" />Explain</Button>}
        {allowImage && (
          <>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={ocrBusy}><Camera className="h-4 w-4" />Photo of question</Button>
          </>
        )}
        <span className="text-xs text-subtle">Ctrl/⌘ + Enter to send</span>
      </div>

      {(answer || busy) && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><AiLabel text="AI tutor answer" /><span className="text-xs text-muted">Check important results with your textbook.</span></div>
            {!busy && answer && (
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(answer); toast("Copied."); }}><Copy className="h-4 w-4" />Copy</Button>
                <Button size="sm" variant="ghost" onClick={saveNote}><BookmarkPlus className="h-4 w-4" />Save to notes</Button>
                <Button size="sm" variant="secondary" onClick={print}><Printer className="h-4 w-4" />Print</Button>
              </div>
            )}
          </div>
          <div id="tutor-answer" className={cn(notebook ? "notebook" : "card card-pad")}>
            {answer ? <Markdown className="te">{answer}</Markdown> : <div className="flex items-center gap-2 text-sm text-muted"><Sparkles className="h-4 w-4 animate-pulse text-brand" />Thinking it through step by step…</div>}
          </div>
        </div>
      )}
    </div>
  );
}

async function downscale(file: File, max = 1600): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
