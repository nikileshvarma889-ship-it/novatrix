"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wand2 } from "lucide-react";
import { AiLabel, Button, Field, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { postJson } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { CHAPTERS } from "@/lib/syllabus";
import { LEVELS, SUBJECTS } from "@/lib/utils";

export function QuizGenerator({ subject: s0, chapterId: c0, compact, initialSubject }: { subject?: string; chapterId?: string | null; compact?: boolean; initialSubject?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const { profile } = useProfile();
  const [subject, setSubject] = useState(s0 ?? (initialSubject || "mathematics"));
  const [chapter, setChapter] = useState(c0 ?? "");
  const [level, setLevel] = useState<string>(profile.study_level);
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const { id } = await postJson<{ id: string }>("/api/ai/quiz", { subject, chapterId: chapter || null, level, difficulty, count, minutesPerQuestion: level === "eapcet" ? 1 : 1.5 });
      router.push(`/quizzes/${id}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Quiz generation failed.", "error"); setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
        {!s0 && <Field label="Subject"><Select value={subject} onChange={(e) => { setSubject(e.target.value); setChapter(""); }}>{SUBJECTS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>}
        <Field label="Chapter"><Select value={chapter} onChange={(e) => setChapter(e.target.value)}><option value="">Whole subject (level-wise)</option>{CHAPTERS.filter((c) => c.subject === subject).map((c) => <option key={c.id} value={c.id}>{c.paper} · {c.title}</option>)}</Select></Field>
        <Field label="Level"><Select value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        <Field label="Difficulty"><Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></Select></Field>
        <Field label="Questions"><Select value={count} onChange={(e) => setCount(+e.target.value)}>{[5, 10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n} questions</option>)}</Select></Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={go} loading={busy}><Wand2 className="h-4 w-4" />{busy ? "Writing your quiz…" : "Generate quiz"}</Button>
        <AiLabel text="AI-generated practice — not official EAPCET questions" />
      </div>
    </div>
  );
}
