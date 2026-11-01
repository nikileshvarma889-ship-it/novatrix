"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, Card, ErrorBox, Loading, Page, StatusBadge, useAction, useApi } from "@/components/ui";

type Pub = { id: string; video_id: string; status: string; scheduled_at: string | null; published_at: string | null; title: string; account_name: string; platform: string; video_status: string };
type Video = { id: string; title: string; status: string; created_at: string };
type Item = { key: string; date: Date; title: string; status: string; href: string; pubId?: string; draggable: boolean; sub: string };
type View = "month" | "week" | "day";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export default function CalendarPage() {
  const pubs = useApi<Pub[]>("/api/publications");
  const videos = useApi<Video[]>("/api/videos");
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(startOfDay(new Date()));
  const [dragging, setDragging] = useState<string | null>(null);
  const { run } = useAction();

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    for (const p of pubs.data ?? []) {
      const when = p.published_at ?? p.scheduled_at;
      if (!when || p.status === "cancelled") continue;
      out.push({ key: p.id, pubId: p.id, date: new Date(when), title: p.title, status: p.status, href: `/create/${p.video_id}`, sub: `${p.account_name} · ${p.platform}`, draggable: ["scheduled", "waiting_approval", "approved", "failed"].includes(p.status) });
    }
    const hasPub = new Set((pubs.data ?? []).map((p) => p.video_id));
    for (const v of videos.data ?? [])
      if (!hasPub.has(v.id) && ["ready", "scripting", "rendering", "draft"].includes(v.status))
        out.push({ key: v.id, date: new Date(v.created_at), title: v.title, status: v.status, href: `/create/${v.id}`, sub: "Draft", draggable: false });
    return out.sort((a, b) => +a.date - +b.date);
  }, [pubs.data, videos.data]);

  const days: Date[] = useMemo(() => {
    if (view === "day") return [cursor];
    if (view === "week") {
      const s = addDays(cursor, -((cursor.getDay() + 6) % 7));
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const s = addDays(first, -((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => addDays(s, i));
  }, [view, cursor]);

  const move = (n: number) => setCursor(view === "month" ? new Date(cursor.getFullYear(), cursor.getMonth() + n, 1) : addDays(cursor, view === "week" ? 7 * n : n));
  const drop = (day: Date) => {
    const it = items.find((i) => i.key === dragging);
    setDragging(null);
    if (!it?.pubId) return;
    const target = new Date(day.getFullYear(), day.getMonth(), day.getDate(), it.date.getHours(), it.date.getMinutes());
    if (sameDay(target, it.date)) return;
    if (target.getTime() < Date.now()) return run(async () => { throw new Error("Drop onto today or a future day."); });
    run(async () => { await api(`/api/publications/${it.pubId}`, { method: "PATCH", json: { action: "reschedule", scheduledAt: target.toISOString() } }); pubs.reload(); }, `Moved to ${target.toLocaleDateString()}.`);
  };
  const label = view === "month" ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : view === "week" ? `Week of ${days[0].toLocaleDateString()}` : cursor.toLocaleDateString(undefined, { weekday: "long", dateStyle: "long" } as Intl.DateTimeFormatOptions);
  return (
    <Page title="Content Calendar" subtitle="Scheduled posts, drafts, pending approvals and published content. Drag scheduled posts to another day to reschedule.">
      <Card className="!p-3 md:!p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button className="btn-ghost !p-2" onClick={() => move(-1)} aria-label="Previous"><ChevronLeft className="h-5 w-5" /></button>
          <button className="btn-ghost !p-2" onClick={() => move(1)} aria-label="Next"><ChevronRight className="h-5 w-5" /></button>
          <button className="btn-outline !py-1.5 text-xs" onClick={() => setCursor(startOfDay(new Date()))}>Today</button>
          <div className="ml-1 font-display text-lg font-bold">{label}</div>
          <div className="ml-auto flex rounded-xl bg-white/70 p-1">
            {(["day", "week", "month"] as View[]).map((v) => <button key={v} onClick={() => setView(v)} className={clsx("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", view === v ? "bg-white text-ink shadow-soft" : "text-ink-soft")}>{v}</button>)}
          </div>
        </div>
        {pubs.loading ? <Loading /> : null}
        {pubs.error ? <ErrorBox error={pubs.error} /> : null}
        {view === "month" ? <div className="mb-1 hidden grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-ink-faint md:grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}</div> : null}
        <div className={clsx("grid gap-1", view === "month" ? "grid-cols-1 md:grid-cols-7" : view === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-1")}>
          {days.map((d) => {
            const dayItems = items.filter((i) => sameDay(i.date, d));
            const muted = view === "month" && d.getMonth() !== cursor.getMonth();
            if (view === "month" && muted && !dayItems.length) return <div key={d.toISOString()} className="hidden min-h-[96px] rounded-xl bg-white/20 md:block" />;
            return (
              <div
                key={d.toISOString()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(d)}
                className={clsx("rounded-xl border border-transparent p-2 transition", view === "day" ? "min-h-[300px]" : "min-h-[96px]", sameDay(d, new Date()) ? "bg-brand-50/80 ring-1 ring-brand-200" : "bg-white/60", dragging && "hover:border-brand-300")}
              >
                <div className={clsx("mb-1 text-xs font-semibold", muted ? "text-ink-faint" : "text-ink-soft")}>{d.toLocaleDateString(undefined, view === "month" ? { day: "numeric" } : { weekday: "short", day: "numeric", month: "short" })}</div>
                <div className="space-y-1">
                  {dayItems.map((i) => (
                    <Link
                      key={i.key}
                      href={i.href}
                      draggable={i.draggable}
                      onDragStart={() => setDragging(i.key)}
                      className={clsx("block rounded-lg bg-white px-2 py-1.5 text-xs shadow-soft transition hover:shadow-lift", i.draggable && "cursor-grab")}
                    >
                      <div className="line-clamp-1 font-semibold">{i.title}</div>
                      <div className="flex items-center justify-between gap-1"><span className="line-clamp-1 text-[10px] text-ink-faint">{i.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {i.sub}</span></div>
                      <div className="mt-0.5"><StatusBadge status={i.status} /></div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </Page>
  );
}
