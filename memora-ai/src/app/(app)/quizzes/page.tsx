"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FileText, ListChecks, Trash2, Wand2 } from "lucide-react";
import { AiLabel, Badge, Button, Card, CardTitle, Empty, Field, PageHeader, Select, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { QuizGenerator } from "@/components/QuizGenerator";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useData, must, postJson } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { LEVELS, SUBJECTS, levelName, subjectName } from "@/lib/utils";
import { relative } from "@/lib/dates";

type Quiz = { id: string; title: string; subject: string | null; level: string; difficulty: string; ai_generated: boolean; created_at: string; questions: unknown[]; quiz_attempts: { score: number; total: number; submitted_at: string }[] };

function QuizzesInner() {
  const params = useSearchParams();
  const toast = useToast();
  const { data, loading, setData } = useData(async () => must(await supabaseBrowser().from("quizzes").select("id,title,subject,level,difficulty,ai_generated,created_at,questions,quiz_attempts(score,total,submitted_at)").order("created_at", { ascending: false }).limit(100)) as Quiz[]);
  const del = async (q: Quiz) => {
    if (!confirm(`Delete “${q.title}” and its results?`)) return;
    const { error } = await supabaseBrowser().from("quizzes").delete().eq("id", q.id);
    if (error) return toast(error.message, "error");
    setData((d) => d?.filter((x) => x.id !== q.id) ?? d);
  };
  const doc = params.get("doc");
  return (
    <div className="space-y-5">
      <PageHeader title="Quizzes" sub="Timed practice tests with explanations and topic-wise analysis." icon={<ListChecks className="h-5 w-5" />} />
      {doc ? <DocQuiz docId={doc} subject={params.get("subject") || "physics"} /> : (
        <Card>
          <CardTitle icon={<Wand2 className="h-4 w-4" />} title="Create a practice test" sub="Choose subject, chapter, level and difficulty" />
          <QuizGenerator key={params.toString()} initialSubject={params.get("subject")} chapterId={params.get("chapter")} />
        </Card>
      )}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Your tests</h2>
        {loading ? <Skeleton className="h-40" /> : !data?.length ? <Empty icon={<ListChecks className="h-5 w-5" />} title="No quizzes yet" text="Generate your first practice test above." /> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.map((q) => {
              const best = q.quiz_attempts.reduce((m, a) => Math.max(m, a.total ? a.score / a.total : 0), -1);
              const last = [...q.quiz_attempts].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0];
              return (
                <Card key={q.id} className="group flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2"><Link href={`/quizzes/${q.id}`} className="font-semibold hover:text-brand">{q.title}</Link><button onClick={() => del(q)} className="text-subtle opacity-0 transition hover:text-danger group-hover:opacity-100" aria-label="Delete quiz"><Trash2 className="h-4 w-4" /></button></div>
                  <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone={SUBJECTS.find((s) => s.id === q.subject)?.color ?? "default"}>{subjectName(q.subject)}</Badge><Badge>{levelName(q.level)}</Badge><Badge>{q.difficulty}</Badge><Badge>{q.questions.length} Q</Badge>{q.ai_generated && <AiLabel />}</div>
                  <div className="mt-3 flex-1 text-sm text-muted">{last ? <>Last score <b className="text-fg">{last.score}/{last.total}</b> · best {Math.round(best * 100)}% · {q.quiz_attempts.length} attempt{q.quiz_attempts.length === 1 ? "" : "s"}</> : "Not attempted yet"}</div>
                  <div className="mt-3 flex items-center justify-between text-xs text-subtle"><span>Created {relative(q.created_at)}</span><Link href={`/quizzes/${q.id}`}><Button size="sm" variant={last ? "secondary" : "primary"}>{last ? "Retake" : "Start"}</Button></Link></div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DocQuiz({ docId, subject: s0 }: { docId: string; subject: string }) {
  const router = useRouter();
  const toast = useToast();
  const { profile } = useProfile();
  const [subject, setSubject] = useState(SUBJECTS.some((s) => s.id === s0) ? s0 : "physics");
  const [level, setLevel] = useState<string>(profile.study_level);
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const { data: doc } = useData(async () => (await supabaseBrowser().from("documents").select("title").eq("id", docId).maybeSingle()).data as { title: string } | null, [docId]);
  const go = async () => {
    setBusy(true);
    try { const { id } = await postJson<{ id: string }>("/api/ai/quiz", { subject, level, difficulty, count, sourceKind: "document", sourceId: docId }); router.push(`/quizzes/${id}`); }
    catch (e) { toast(e instanceof Error ? e.message : "Quiz generation failed.", "error"); setBusy(false); }
  };
  return (
    <Card>
      <CardTitle icon={<FileText className="h-4 w-4" />} title={`Quiz from “${doc?.title ?? "document"}”`} sub="Questions are based only on your document" />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Subject"><Select value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Level"><Select value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Difficulty"><Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></Field>
        <Field label="Questions"><Select value={count} onChange={(e) => setCount(+e.target.value)}>{[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
      </div>
      <div className="mt-4 flex items-center gap-3"><Button onClick={go} loading={busy}><Wand2 className="h-4 w-4" />Generate quiz</Button><AiLabel /></div>
    </Card>
  );
}

export default function QuizzesPage() {
  return <Suspense><QuizzesInner /></Suspense>;
}
