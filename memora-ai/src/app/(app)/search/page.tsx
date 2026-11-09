"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BookOpen, Brain, CalendarClock, FileText, NotebookPen, Search, Sparkles, Youtube } from "lucide-react";
import { Button, Card, Empty, PageHeader, Spinner } from "@/components/ui";
import { subjectName, truncate } from "@/lib/utils";
import { fmt } from "@/lib/dates";

type Res = {
  memories: { id: string; title: string; content: string; category: string; updated_at: string }[];
  notes: { id: string; title: string; snippet: string; subject: string | null }[];
  tasks: { id: string; title: string; kind: string; due_at: string | null; status: string }[];
  documents: { id: string; title: string; status: string }[];
  videos: { video_id: string; title: string; channel_title: string }[];
  chapters: { id: string; title: string; subject: string; paper: string }[];
};

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<Res | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setQ(initial);
    if (!initial) { setRes(null); return; }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(initial)}`).then((r) => r.json()).then(setRes).finally(() => setLoading(false));
  }, [initial]);
  const total = res ? res.memories.length + res.notes.length + res.tasks.length + res.documents.length + res.videos.length + res.chapters.length : 0;
  const Section = ({ title, icon, children, n }: { title: string; icon: React.ReactNode; children: React.ReactNode; n: number }) => n ? <Card><div className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon}{title}<span className="text-xs font-normal text-muted">({n})</span></div><div className="space-y-1.5">{children}</div></Card> : null;
  const Row = ({ href, title, sub }: { href: string; title: string; sub?: string }) => <Link href={href} className="block rounded-xl px-3 py-2 hover:bg-surface-2"><div className="text-sm font-medium te">{title}</div>{sub ? <div className="text-xs text-muted te">{sub}</div> : null}</Link>;
  return (
    <div>
      <PageHeader title="Search" sub="Everything you've saved in MEMORA, in one place." icon={<Search className="h-5 w-5" />} />
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.replace(`/search?q=${encodeURIComponent(q.trim())}`); }} className="mb-5 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input h-11" placeholder="Search memories, notes, tasks, documents, videos, chapters…" autoFocus />
        <Button type="submit" className="h-11">Search</Button>
      </form>
      {loading ? <div className="grid place-items-center py-16"><Spinner /></div> : !initial ? null : total === 0 ? (
        <Empty icon={<Search className="h-5 w-5" />} title={`Nothing saved matches “${initial}”`} text="MEMORA only searches what you have saved. You can ask the AI assistant instead." action={<Button onClick={() => router.push(`/assistant?q=${encodeURIComponent(initial)}`)}><Sparkles className="h-4 w-4" />Ask MEMORA</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Memories" icon={<Brain className="h-4 w-4 text-brand" />} n={res!.memories.length}>{res!.memories.map((m) => <Row key={m.id} href={`/memories?open=${m.id}`} title={m.title} sub={`${m.category} · ${truncate(m.content, 90)}`} />)}</Section>
          <Section title="Notes" icon={<NotebookPen className="h-4 w-4 text-brand" />} n={res!.notes.length}>{res!.notes.map((n) => <Row key={n.id} href={`/notes/${n.id}`} title={n.title} sub={truncate(n.snippet, 100)} />)}</Section>
          <Section title="Tasks & assignments" icon={<CalendarClock className="h-4 w-4 text-brand" />} n={res!.tasks.length}>{res!.tasks.map((t) => <Row key={t.id} href={t.kind === "assignment" ? "/planner?tab=assignments" : "/planner?tab=tasks"} title={t.title} sub={`${t.kind.replace("_", " ")} · ${t.status.replace("_", " ")}${t.due_at ? " · due " + fmt(t.due_at) : ""}`} />)}</Section>
          <Section title="Documents" icon={<FileText className="h-4 w-4 text-brand" />} n={res!.documents.length}>{res!.documents.map((d) => <Row key={d.id} href={`/documents/${d.id}`} title={d.title} sub={d.status} />)}</Section>
          <Section title="Videos" icon={<Youtube className="h-4 w-4 text-brand" />} n={res!.videos.length}>{res!.videos.map((v) => <Row key={v.video_id} href={`/youtube/watch/${v.video_id}`} title={v.title} sub={v.channel_title} />)}</Section>
          <Section title="Syllabus chapters" icon={<BookOpen className="h-4 w-4 text-brand" />} n={res!.chapters.length}>{res!.chapters.map((c) => <Row key={c.id} href={`/study/${c.subject}?chapter=${c.id}`} title={c.title} sub={`${subjectName(c.subject)} · Paper ${c.paper}`} />)}</Section>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense><SearchInner /></Suspense>;
}
