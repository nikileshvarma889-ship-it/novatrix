"use client";
import { useState } from "react";
import Link from "next/link";
import { ListChecks, RotateCcw, XCircle } from "lucide-react";
import { api, Card, Empty, ErrorBox, Loading, Page, StatusBadge, fmtDate, mediaUrl, useAction, useApi } from "@/components/ui";

type Pub = { id: string; video_id: string; status: string; scheduled_at: string | null; published_at: string | null; external_url: string | null; error: string | null; title: string; account_name: string; platform: string; thumbnail_media_id: string | null };
const FILTERS = ["all", "waiting_approval", "scheduled", "publishing", "published", "failed"];

export default function QueuePage() {
  const { data, error, loading, reload } = useApi<Pub[]>("/api/publications", 8000);
  const [filter, setFilter] = useState("all");
  const { busy, run } = useAction();
  const list = data?.filter((p) => filter === "all" || p.status === filter) ?? [];
  const act = (id: string, action: "cancel" | "retry") => run(async () => { await api(`/api/publications/${id}`, { method: "PATCH", json: { action } }); reload(); }, action === "cancel" ? "Cancelled." : "Retrying now.");
  return (
    <Page title="Publishing Queue" subtitle="Every post and its real status. A post shows Published only after the platform confirms it.">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? "bg-brand-500 text-white" : "bg-white/80 text-ink-soft"}`}>{f === "all" ? "All" : <StatusBadge status={f} />}</button>)}
      </div>
      {loading ? <Loading /> : null}
      {error ? <ErrorBox error={error} /> : null}
      {data && !list.length ? <Empty icon={ListChecks} title="Nothing here" text="Approve a video to add it to the queue." /> : null}
      <div className="space-y-2">
        {list.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3 !p-3 sm:flex-row sm:items-center">
            <Link href={`/create/${p.video_id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-brand-50">{p.thumbnail_media_id ? <img src={mediaUrl(p.thumbnail_media_id)} alt="" className="h-full w-full object-cover" /> : null}</div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{p.title}</div>
                <div className="text-xs text-ink-soft">{p.account_name} · <span className="capitalize">{p.platform}</span></div>
                <div className="text-xs text-ink-faint">{p.published_at ? `Published ${fmtDate(p.published_at)}` : `Scheduled ${fmtDate(p.scheduled_at)}`}</div>
                {p.error ? <div className="text-xs text-red-600">{p.error}</div> : null}
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <StatusBadge status={p.status} />
              {p.external_url ? <a className="btn-outline !py-1.5 text-xs" href={p.external_url} target="_blank" rel="noreferrer">View post</a> : null}
              {p.status === "failed" ? <button className="btn-outline !py-1.5 text-xs" disabled={busy} onClick={() => act(p.id, "retry")}><RotateCcw className="h-3.5 w-3.5" /> Retry</button> : null}
              {["scheduled", "waiting_approval", "approved", "failed"].includes(p.status) ? <button className="btn-ghost !py-1.5 text-xs" disabled={busy} onClick={() => act(p.id, "cancel")}><XCircle className="h-3.5 w-3.5" /> Cancel</button> : null}
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}
