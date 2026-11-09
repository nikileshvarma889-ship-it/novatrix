"use client";
import Link from "next/link";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Atom, BookOpen, CalendarPlus, CheckCircle2, ChevronDown, Circle, CircleDot, FlaskConical, Layers, ListChecks, Save, Sigma, Star, Wand2, Youtube, NotebookPen } from "lucide-react";
import { Badge, Button, Card, Empty, Input, PageHeader, Progress, Skeleton, Tabs, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { TutorPanel } from "@/components/TutorPanel";
import { QuizGenerator } from "@/components/QuizGenerator";
import { Tex } from "@/components/Markdown";
import { PeriodicTable } from "@/components/PeriodicTable";
import { useProfile } from "@/hooks/useProfile";
import { useData, must } from "@/hooks/useData";
import { supabaseBrowser } from "@/lib/supabase/client";
import { FORMULAS } from "@/lib/formulas";
import { SUBJECTS, cn, levelName } from "@/lib/utils";
import { chaptersForLevel, trackFor, type Level, type ProgressRow } from "@/lib/progress";
import { relative } from "@/lib/dates";

const ICONS = { mathematics: Sigma, physics: Atom, chemistry: FlaskConical } as const;
type Tab = "chapters" | "tutor" | "formulas" | "practice" | "saved" | "periodic";

function SubjectInner() {
  const { subject } = useParams<{ subject: string }>();
  const meta = SUBJECTS.find((s) => s.id === subject);
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useProfile();
  const level = profile.study_level as Level;
  const track = trackFor(level);
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "chapters");
  const [open, setOpen] = useState<string | null>(params.get("chapter"));
  const [tutorChapter, setTutorChapter] = useState<string | null>(params.get("chapter"));
  const [fq, setFq] = useState("");
  const [seed, setSeed] = useState<string | undefined>(undefined);

  const { data: rows, setData: setRows, loading } = useData(async () => must(await supabaseBrowser().from("chapter_progress").select("chapter_id,track,status,important,personal_notes,revision_due,completed_at").eq("track", track)) as ProgressRow[], [track]);
  const { data: saved } = useData(async () => (tab === "saved" ? (must(await supabaseBrowser().from("notes").select("id,title,updated_at").eq("subject", subject).contains("tags", ["ai-tutor"]).order("updated_at", { ascending: false }).limit(50)) as { id: string; title: string; updated_at: string }[]) : null), [tab, subject]);

  useEffect(() => { if (open) setTimeout(() => document.getElementById(`ch-${open}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300); }, [open]);

  if (!meta) notFound();
  const chapters = chaptersForLevel(level, meta.id);
  const map = new Map((rows ?? []).map((r) => [r.chapter_id, r]));
  const completed = chapters.filter((c) => map.get(c.id)?.status === "completed").length;
  const papers = Array.from(new Set(chapters.map((c) => c.paper)));
  const Icon = ICONS[meta.id];

  const upsert = async (chapterId: string, p: Partial<ProgressRow>, msg?: string) => {
    const prev = map.get(chapterId);
    const row = { chapter_id: chapterId, track, status: prev?.status ?? "not_started", important: prev?.important ?? false, personal_notes: prev?.personal_notes ?? "", revision_due: prev?.revision_due ?? null, ...p };
    if (p.status) row.completed_at = p.status === "completed" ? new Date().toISOString() : null;
    const { error } = await supabaseBrowser().from("chapter_progress").upsert(row, { onConflict: "user_id,chapter_id,track" });
    if (error) { toast(error.message, "error"); return; }
    setRows((r) => [...(r ?? []).filter((x) => x.chapter_id !== chapterId), row as ProgressRow]);
    if (msg) toast(msg);
  };

  const formulas = FORMULAS[meta.id].filter((f) => !fq || (f.name + f.topic).toLowerCase().includes(fq.toLowerCase()));
  const tabs: { id: Tab; label: string }[] = [
    { id: "chapters", label: "Chapters" }, { id: "tutor", label: "AI Tutor" }, { id: "formulas", label: "Formula library" }, { id: "practice", label: "Practice" }, { id: "saved", label: "Saved answers" },
    ...(meta.id === "chemistry" ? [{ id: "periodic" as Tab, label: "Periodic table" }] : []),
  ];

  return (
    <div className="space-y-5">
      <Link href="/study" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Study Centre</Link>
      <PageHeader title={meta.name} sub={`${levelName(level)} · ${completed}/${chapters.length} chapters complete`} icon={<Icon className="h-5 w-5" />}
        actions={<div className="w-48"><Progress value={(completed / Math.max(1, chapters.length)) * 100} tone={meta.color} /></div>} />
      <Tabs tabs={tabs} value={tab} onChange={(t) => { setTab(t); router.replace(`/study/${meta.id}?tab=${t}`, { scroll: false }); }} className="w-full sm:w-fit" />

      {tab === "chapters" && (loading ? <Skeleton className="h-96" /> : (
        <div className="space-y-6">
          {papers.map((paper) => (
            <section key={paper}>
              <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-subtle">{meta.id === "mathematics" ? `Paper ${paper}` : `${paper === "I" ? "First" : "Second"} year`}</h2>
              <div className="space-y-2">
                {chapters.filter((c) => c.paper === paper).map((c) => {
                  const r = map.get(c.id);
                  const st = r?.status ?? "not_started";
                  const isOpen = open === c.id;
                  return (
                    <div key={c.id} id={`ch-${c.id}`} className={cn("card overflow-hidden p-0 transition", isOpen && "border-brand/40")}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button onClick={() => upsert(c.id, { status: st === "completed" ? "not_started" : st === "in_progress" ? "completed" : "in_progress" }, st === "in_progress" ? "Chapter completed! 🎉" : undefined)}
                          aria-label={`Status: ${st.replace("_", " ")}. Click to change.`} title="Click: not started → in progress → completed" className="shrink-0">
                          {st === "completed" ? <CheckCircle2 className="h-6 w-6 text-ok" /> : st === "in_progress" ? <CircleDot className="h-6 w-6 text-warn" /> : <Circle className="h-6 w-6 text-subtle" />}
                        </button>
                        <button onClick={() => setOpen(isOpen ? null : c.id)} className="min-w-0 flex-1 text-left">
                          <div className={cn("truncate text-[14.5px] font-medium", st === "completed" && "text-muted")}>{c.position}. {c.title}</div>
                          <div className="flex flex-wrap gap-x-3 text-xs text-muted"><span>{st.replace("_", " ")}</span>{r?.revision_due && <span className="text-brand">Revise {r.revision_due}</span>}{r?.personal_notes && <span>has notes</span>}</div>
                        </button>
                        <button onClick={() => upsert(c.id, { important: !r?.important }, r?.important ? "Removed from important topics." : "Marked important.")} aria-label="Mark important" className="p-1"><Star className={cn("h-5 w-5", r?.important ? "fill-warn text-warn" : "text-subtle")} /></button>
                        <button onClick={() => setOpen(isOpen ? null : c.id)} aria-label="Expand"><ChevronDown className={cn("h-5 w-5 text-subtle transition", isOpen && "rotate-180")} /></button>
                      </div>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                            <ChapterDetail key={c.id} row={r} title={c.title} chapterId={c.id} subject={meta.id} onSave={upsert}
                              onTutor={() => { setTutorChapter(c.id); setTab("tutor"); }} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ))}

      {tab === "tutor" && <Card><TutorPanel key={seed ?? "tutor"} subject={meta.id} chapterId={tutorChapter} onChapter={(id) => setTutorChapter(id || null)} initialQuestion={seed} initialStyle={seed ? "formula" : undefined} /></Card>}

      {tab === "formulas" && (
        <div className="space-y-4">
          <Input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Filter formulas by name or topic…" className="max-w-md" />
          <div className="grid gap-3 md:grid-cols-2">
            {formulas.map((f) => (
              <Card key={f.name} className="p-4">
                <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{f.name}</h3><Badge tone={meta.color}>{f.topic}</Badge></div>
                <div className="mt-2 overflow-x-auto"><Tex tex={f.tex} block /></div>
                {f.note && <p className="mt-1 text-xs text-muted">{f.note}</p>}
                <button onClick={() => { setSeed(`Explain the formula "${f.name}": $${f.tex}$`); setTutorChapter(null); setTab("tutor"); }} className="mt-2 text-xs text-brand hover:underline">Explain with AI →</button>
              </Card>
            ))}
          </div>
          {!formulas.length && <Empty title="No formula matches your filter" />}
        </div>
      )}

      {tab === "practice" && (
        <Card>
          <h2 className="mb-1 font-semibold">Practice test</h2>
          <p className="mb-4 text-sm text-muted">Generate a timed multiple-choice test for {meta.name}. {level === "eapcet" ? "EAPCET-style: quick, conceptual and numerical." : "Board-exam level."}</p>
          <QuizGenerator subject={meta.id} chapterId={open} />
        </Card>
      )}

      {tab === "saved" && (
        !saved ? <Skeleton className="h-40" /> : saved.length ? (
          <div className="grid gap-2 sm:grid-cols-2">{saved.map((n) => <Link key={n.id} href={`/notes/${n.id}`} className="card flex items-center gap-3 p-3 hover:border-brand/40"><NotebookPen className="h-4 w-4 text-brand" /><span className="min-w-0 flex-1 truncate text-sm">{n.title}</span><span className="text-xs text-subtle">{relative(n.updated_at)}</span></Link>)}</div>
        ) : <Empty icon={<BookOpen className="h-5 w-5" />} title="No saved answers yet" text="Use “Save to notes” under any AI tutor answer to keep it here." />
      )}

      {tab === "periodic" && <PeriodicTable />}
    </div>
  );
}

function ChapterDetail({ row, title, chapterId, subject, onSave, onTutor }: { row?: ProgressRow; title: string; chapterId: string; subject: string; onSave: (id: string, p: Partial<ProgressRow>, msg?: string) => Promise<void>; onTutor: () => void }) {
  const [notes, setNotes] = useState(row?.personal_notes ?? "");
  const [rev, setRev] = useState(row?.revision_due ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = notes !== (row?.personal_notes ?? "") || rev !== (row?.revision_due ?? "");
  const yt = `/youtube?q=${encodeURIComponent(`${title} ${subject} intermediate`)}`;
  return (
    <div className="space-y-3 border-t border-border/60 bg-surface-2/30 px-4 py-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onTutor}><Wand2 className="h-4 w-4" />Explain with AI</Button>
        <Link href={`/quizzes?subject=${subject}&chapter=${chapterId}`}><Button size="sm" variant="secondary"><ListChecks className="h-4 w-4" />Practice quiz</Button></Link>
        <Link href={`/flashcards?generate=${chapterId}`}><Button size="sm" variant="secondary"><Layers className="h-4 w-4" />Flashcards</Button></Link>
        <Link href={yt}><Button size="sm" variant="secondary"><Youtube className="h-4 w-4" />Video lessons</Button></Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <label><span className="label">My notes for this chapter</span><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Key points, doubts, teacher's tips…" className="te min-h-[90px] bg-surface" /></label>
        <label><span className="label"><CalendarPlus className="mr-1 inline h-3 w-3" />Revision date</span><Input type="date" value={rev} onChange={(e) => setRev(e.target.value)} className="bg-surface" /><span className="mt-1 block text-[11px] text-subtle">You&apos;ll get a reminder on this day.</span></label>
      </div>
      <div className="flex justify-end"><Button size="sm" disabled={!dirty} loading={saving} onClick={async () => { setSaving(true); await onSave(chapterId, { personal_notes: notes, revision_due: rev || null }, "Chapter notes saved."); setSaving(false); }}><Save className="h-4 w-4" />Save</Button></div>
    </div>
  );
}

export default function SubjectPage() {
  return <Suspense><SubjectInner /></Suspense>;
}
