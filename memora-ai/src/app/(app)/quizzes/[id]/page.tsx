"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flag, RotateCcw, Send, Target, XCircle } from "lucide-react";
import { AiLabel, Badge, Button, Card, CardTitle, Empty, Progress, Ring, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { Markdown } from "@/components/Markdown";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, formatDuration, levelName, subjectName } from "@/lib/utils";

type Q = { question: string; options: string[]; answer: number; explanation: string; topic: string };
type Quiz = { id: string; title: string; subject: string | null; level: string; difficulty: string; time_limit_seconds: number; ai_generated: boolean; questions: Q[] };
type Result = { answers: (number | null)[]; correct: number; incorrect: number; unanswered: number; score: number; total: number; time: number; topics: Record<string, { correct: number; total: number }> };

export default function TakeQuizPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(undefined);
  const [phase, setPhase] = useState<"intro" | "test" | "result">("intro");
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [marked, setMarked] = useState<boolean[]>([]);
  const [cur, setCur] = useState(0);
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);
  const started = useRef(0);

  useEffect(() => { supabaseBrowser().from("quizzes").select("*").eq("id", id).maybeSingle().then(({ data }) => setQuiz(data as Quiz | null)); }, [id]);

  const start = () => {
    if (!quiz) return;
    setAnswers(Array(quiz.questions.length).fill(null)); setMarked(Array(quiz.questions.length).fill(false));
    setCur(0); setLeft(quiz.time_limit_seconds); started.current = Date.now(); setResult(null); setPhase("test");
  };

  const submit = useCallback(async (auto = false) => {
    if (!quiz || saving) return;
    const unanswered = answers.filter((a) => a === null).length;
    if (!auto && unanswered && !confirm(`${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered. Submit anyway?`)) return;
    const time = Math.min(quiz.time_limit_seconds, Math.round((Date.now() - started.current) / 1000));
    const topics: Result["topics"] = {};
    let correct = 0;
    quiz.questions.forEach((q, i) => {
      const t = q.topic || "General";
      topics[t] ??= { correct: 0, total: 0 };
      topics[t].total++;
      if (answers[i] === q.answer) { correct++; topics[t].correct++; }
    });
    const r: Result = { answers, correct, incorrect: quiz.questions.length - correct - unanswered, unanswered, score: correct, total: quiz.questions.length, time, topics };
    setSaving(true);
    const { error } = await supabaseBrowser().from("quiz_attempts").insert({ quiz_id: quiz.id, answers, marked: marked.map((m, i) => (m ? i : -1)).filter((i) => i >= 0), score: r.score, total: r.total, correct: r.correct, incorrect: r.incorrect, unanswered: r.unanswered, time_taken_seconds: time, topic_breakdown: topics });
    setSaving(false);
    if (error) toast(`Your result couldn't be saved: ${error.message}`, "error");
    if (auto) toast("Time's up — your test was submitted.", "info");
    setResult(r); setPhase("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [quiz, answers, marked, saving, toast]);

  useEffect(() => {
    if (phase !== "test") return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => { if (phase === "test" && left <= 0 && quiz) submit(true); }, [left, phase, quiz, submit]);

  if (quiz === undefined) return <Skeleton className="h-96" />;
  if (!quiz) return <Empty title="Quiz not found" action={<Link href="/quizzes"><Button size="sm" variant="secondary">Back to quizzes</Button></Link>} />;
  const q = quiz.questions[cur];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/quizzes" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Quizzes</Link>

      {phase === "intro" && (
        <Card className="p-6 text-center sm:p-10">
          <Target className="mx-auto h-12 w-12 text-brand" />
          <h1 className="mt-4 text-2xl font-semibold">{quiz.title}</h1>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5"><Badge>{subjectName(quiz.subject)}</Badge><Badge>{levelName(quiz.level)}</Badge><Badge>{quiz.difficulty}</Badge>{quiz.ai_generated && <AiLabel text="AI-generated practice" />}</div>
          <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-surface-2/60 p-3"><div className="text-xl font-bold">{quiz.questions.length}</div>questions</div><div className="rounded-xl bg-surface-2/60 p-3"><div className="text-xl font-bold">{formatDuration(quiz.time_limit_seconds)}</div>time limit</div></div>
          <p className="mx-auto mt-5 max-w-md text-xs text-muted">One mark per correct answer, no negative marking. You can mark questions for review and move freely between them. {quiz.ai_generated && "These questions were written by AI for practice — they are not official or previous-year EAPCET questions."}</p>
          <Button className="mt-6 h-11 px-8" onClick={start}>Start test</Button>
        </Card>
      )}

      {phase === "test" && q && (
        <>
          <div className="glass sticky top-16 z-10 -mx-1 flex items-center gap-3 rounded-2xl px-4 py-3">
            <div className="text-sm font-medium">Question {cur + 1}/{quiz.questions.length}</div>
            <Progress value={(answers.filter((a) => a !== null).length / quiz.questions.length) * 100} className="flex-1" />
            <div className={cn("flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums", left < 60 ? "text-danger" : "text-fg")}><Clock className="h-4 w-4" />{formatDuration(Math.max(0, left))}</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <Card className="p-5 sm:p-6">
              <div className="mb-1 flex items-center justify-between"><Badge>{q.topic}</Badge>{quiz.ai_generated && <span className="text-[11px] text-subtle">AI-generated</span>}</div>
              <div className="te mt-2 text-[16px] font-medium"><Markdown>{q.question}</Markdown></div>
              <div className="mt-4 space-y-2.5">
                {q.options.map((o, i) => (
                  <button key={i} onClick={() => setAnswers((a) => a.map((x, j) => (j === cur ? (x === i ? null : i) : x)))}
                    className={cn("flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition", answers[cur] === i ? "border-brand bg-brand/10" : "border-border hover:border-brand/40")}>
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm font-semibold", answers[cur] === i ? "border-brand bg-brand text-white" : "border-border text-muted")}>{"ABCD"[i]}</span>
                    <span className="te min-w-0 flex-1 pt-0.5"><Markdown className="[&_p]:my-0">{o}</Markdown></span>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                <Button variant="ghost" onClick={() => setMarked((m) => m.map((x, j) => (j === cur ? !x : x)))}><Flag className={cn("h-4 w-4", marked[cur] && "fill-warn text-warn")} />{marked[cur] ? "Marked for review" : "Mark for review"}</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0}><ChevronLeft className="h-4 w-4" />Previous</Button>
                  {cur < quiz.questions.length - 1 ? <Button onClick={() => setCur((c) => c + 1)}>Next<ChevronRight className="h-4 w-4" /></Button> : <Button onClick={() => submit()} loading={saving}><Send className="h-4 w-4" />Submit</Button>}
                </div>
              </div>
            </Card>
            <Card className="h-fit p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">Questions</div>
              <div className="grid grid-cols-5 gap-1.5">
                {quiz.questions.map((_, i) => (
                  <button key={i} onClick={() => setCur(i)} className={cn("relative aspect-square rounded-lg border text-xs font-medium", i === cur ? "border-brand ring-2 ring-brand/30" : "border-border", answers[i] !== null ? "bg-brand/15 text-brand" : "text-muted")} aria-label={`Question ${i + 1}`}>
                    {i + 1}{marked[i] && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warn" />}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-[11px] text-muted"><div><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-brand/40" />Answered</div><div><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-warn" />Marked for review</div></div>
              <Button className="mt-4 w-full" variant="secondary" onClick={() => submit()} loading={saving}><Send className="h-4 w-4" />Submit test</Button>
            </Card>
          </div>
        </>
      )}

      {phase === "result" && result && <Results quiz={quiz} r={result} onRetake={start} />}
    </div>
  );
}

function Results({ quiz, r, onRetake }: { quiz: Quiz; r: Result; onRetake: () => void }) {
  const acc = r.total ? Math.round((r.correct / r.total) * 100) : 0;
  const attempted = r.correct + r.incorrect;
  const topics = useMemo(() => Object.entries(r.topics).map(([t, v]) => ({ t, ...v, pct: Math.round((v.correct / v.total) * 100) })).sort((a, b) => a.pct - b.pct), [r]);
  const weak = topics.filter((t) => t.pct < 60);
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Ring value={acc} size={120} stroke={10} label={<span className="text-2xl font-bold">{acc}%</span>} color={acc >= 75 ? "rgb(var(--ok))" : acc >= 50 ? "rgb(var(--warn))" : "rgb(var(--danger))"} />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-semibold">{acc >= 85 ? "Excellent work! 🎉" : acc >= 60 ? "Good effort — keep going!" : "Keep practising — you'll get there."}</h1>
            <p className="mt-1 text-sm text-muted">{quiz.title}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[["Marks", `${r.score}/${r.total}`], ["Correct", r.correct], ["Incorrect", r.incorrect], ["Unanswered", r.unanswered], ["Time", formatDuration(r.time)]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-surface-2/60 p-2.5 text-center"><div className="text-lg font-bold">{v}</div><div className="text-[11px] text-muted">{l}</div></div>)}
            </div>
            <p className="mt-2 text-xs text-muted">Accuracy on attempted questions: {attempted ? Math.round((r.correct / attempted) * 100) : 0}%</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-end"><Button variant="secondary" onClick={onRetake}><RotateCcw className="h-4 w-4" />Retake</Button><Link href="/quizzes"><Button>New quiz</Button></Link></div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle title="Topic-wise performance" />
          <div className="space-y-3">{topics.map((t) => <div key={t.t}><div className="mb-1 flex justify-between text-sm"><span>{t.t}</span><span className="text-muted">{t.correct}/{t.total}</span></div><Progress value={t.pct} tone={t.pct >= 75 ? "ok" : "brand"} /></div>)}</div>
        </Card>
        <Card>
          <CardTitle icon={<Bookmark className="h-4 w-4" />} title="Suggested revision" />
          {weak.length ? (
            <ul className="space-y-2 text-sm">{weak.map((t) => <li key={t.t} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2/50 px-3 py-2"><span>{t.t} <span className="text-muted">({t.pct}%)</span></span><Link href={`/youtube?q=${encodeURIComponent(t.t + " " + (quiz.subject ?? "") + " intermediate")}`} className="text-xs text-brand hover:underline">Find a lesson</Link></li>)}</ul>
          ) : <p className="text-sm text-muted">No weak topics in this test. Try a harder level next time!</p>}
          <p className="mt-3 text-xs text-subtle">Based only on this attempt.</p>
        </Card>
      </div>
      <Card>
        <CardTitle title="Answers & explanations" sub={quiz.ai_generated ? "AI-generated practice questions — verify anything that looks wrong with your textbook." : undefined} />
        <div className="space-y-4">
          {quiz.questions.map((q, i) => {
            const a = r.answers[i];
            const ok = a === q.answer;
            return (
              <div key={i} className={cn("rounded-xl border p-4", ok ? "border-ok/30" : a === null ? "border-border" : "border-danger/30")}>
                <div className="flex items-start gap-2">{ok ? <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-ok" /> : <XCircle className={cn("mt-1 h-5 w-5 shrink-0", a === null ? "text-subtle" : "text-danger")} />}<div className="te min-w-0 flex-1 font-medium"><span className="text-muted">Q{i + 1}. </span><Markdown className="inline [&_p]:inline">{q.question}</Markdown></div></div>
                <div className="mt-2 grid gap-1.5 pl-7 sm:grid-cols-2">
                  {q.options.map((o, j) => <div key={j} className={cn("te rounded-lg border px-3 py-1.5 text-sm", j === q.answer ? "border-ok/50 bg-ok/10" : j === a ? "border-danger/50 bg-danger/10" : "border-border/60")}><b>{"ABCD"[j]}.</b> <Markdown className="inline [&_p]:inline">{o}</Markdown></div>)}
                </div>
                <div className="te mt-2 rounded-lg bg-surface-2/60 p-3 pl-7 text-sm"><span className="font-semibold">Explanation: </span><Markdown className="inline [&_p]:inline">{q.explanation}</Markdown></div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
