"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Atom, BookOpen, FlaskConical, GraduationCap, Sigma, Star, Wand2 } from "lucide-react";
import { Badge, Button, Card, CardTitle, Empty, PageHeader, Progress, Skeleton, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { TutorPanel } from "@/components/TutorPanel";
import { useProfile } from "@/hooks/useProfile";
import { useData, must } from "@/hooks/useData";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LEVELS, SUBJECTS } from "@/lib/utils";
import { subjectStats, trackFor, type Level, type ProgressRow } from "@/lib/progress";
import { CHAPTERS } from "@/lib/syllabus";

const ICONS = { mathematics: Sigma, physics: Atom, chemistry: FlaskConical } as const;

export default function StudyPage() {
  const toast = useToast();
  const { profile, update } = useProfile();
  const level = profile.study_level as Level;
  const { data, loading } = useData(async () => must(await supabaseBrowser().from("chapter_progress").select("chapter_id,track,status,important,personal_notes,revision_due,completed_at")) as ProgressRow[]);
  const stats = useMemo(() => SUBJECTS.map((s) => ({ ...s, ...subjectStats(data ?? [], level, s.id) })), [data, level]);
  const important = (data ?? []).filter((r) => r.important && r.track === trackFor(level)).map((r) => CHAPTERS.find((c) => c.id === r.chapter_id)!).filter(Boolean);
  const setLevel = async (l: Level) => { const { error } = await update({ study_level: l }); if (error) toast(error, "error"); };

  return (
    <div className="space-y-6">
      <PageHeader title="Study Centre" sub="Intermediate & EAPCET — Mathematics, Physics and Chemistry" icon={<GraduationCap className="h-5 w-5" />} />
      <Tabs tabs={LEVELS.map((l) => ({ id: l.id as Level, label: l.name }))} value={level} onChange={setLevel} className="w-fit" />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s, i) => {
          const Icon = ICONS[s.id];
          const next = s.chapters.find((c) => s.map.get(c.id)?.status === "in_progress") ?? s.chapters.find((c) => s.map.get(c.id)?.status !== "completed");
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card className="group relative h-full overflow-hidden">
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-25 blur-2xl" style={{ background: `rgb(var(--${s.color}))` }} />
                <div className="relative flex items-start justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: `rgb(var(--${s.color}))` }}><Icon className="h-6 w-6" /></div>
                  {loading ? <Skeleton className="h-6 w-12" /> : <div className="text-right"><div className="text-2xl font-bold">{s.pct}%</div><div className="text-[11px] text-muted">complete</div></div>}
                </div>
                <h2 className="relative mt-4 text-lg font-semibold">{s.name}</h2>
                <div className="relative mt-1 flex gap-3 text-xs text-muted"><span>{s.completed} completed</span><span>·</span><span>{s.pending} pending</span>{s.inProgress ? <><span>·</span><span>{s.inProgress} in progress</span></> : null}</div>
                <Progress value={s.pct} tone={s.color} className="relative mt-3" />
                {next && <p className="relative mt-3 truncate text-xs text-muted">Next: <span className="text-fg">{next.title}</span></p>}
                <Link href={`/study/${s.id}${next ? `?chapter=${next.id}` : ""}`} className="relative mt-4 block"><Button variant="secondary" className="w-full">Continue learning<ArrowRight className="h-4 w-4" /></Button></Link>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle icon={<Wand2 className="h-4 w-4" />} title="AI study tutor" sub="Explanations in English, Telugu or both — with notebook-style exam answers" />
          <TutorPanelGeneral />
        </Card>
        <Card>
          <CardTitle icon={<Star className="h-4 w-4" />} title="Important topics" sub="Chapters you starred" />
          {loading ? <Skeleton className="h-32" /> : important.length ? (
            <div className="space-y-1.5">{important.map((c) => <Link key={c.id} href={`/study/${c.subject}?chapter=${c.id}`} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm hover:border-brand/40"><span className="truncate">{c.title}</span><Badge tone={SUBJECTS.find((s) => s.id === c.subject)!.color}>{c.paper}</Badge></Link>)}</div>
          ) : <Empty icon={<BookOpen className="h-5 w-5" />} title="No starred chapters" text="Star important chapters inside a subject to collect them here." />}
          <div className="mt-5 rounded-xl border border-border/60 bg-surface-2/40 p-3 text-xs leading-relaxed text-muted">
            Chapter lists follow the AP Board of Intermediate Education structure. Syllabi can change — check with your college. EAPCET mode covers both years.
          </div>
        </Card>
      </div>
    </div>
  );
}

function TutorPanelGeneral() {
  const subjects = ["mathematics", "physics", "chemistry"] as const;
  return <SubjectSwitchTutor subjects={subjects} />;
}
function SubjectSwitchTutor({ subjects }: { subjects: readonly ("mathematics" | "physics" | "chemistry")[] }) {
  const [s, setS] = useState<(typeof subjects)[number]>("mathematics");
  return (
    <div className="space-y-4">
      <Tabs tabs={subjects.map((x) => ({ id: x, label: SUBJECTS.find((y) => y.id === x)!.name }))} value={s} onChange={setS} className="w-fit" />
      <TutorPanel key={s} subject={s} />
    </div>
  );
}
