"use client";
import { useState } from "react";
import { Download, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { api, Card, Empty, ErrorBox, Loading, Page, Spinner, fmtDate, mediaUrl, useAction, useApi } from "@/components/ui";
import { upload } from "@/components/upload";

type Media = { id: string; brand_id: string | null; kind: string; source: string; filename: string; mime: string; size: number; created_at: string; duration_sec: number | null };
const KINDS = ["all", "image", "logo", "video", "audio", "font"];

export default function MediaPage() {
  const [kind, setKind] = useState("all");
  const { data, error, loading, reload } = useApi<Media[]>(`/api/media${kind === "all" ? "" : `?kind=${kind}`}`);
  const { busy, run } = useAction();
  return (
    <Page title="Media Library" subtitle="Uploads, rendered videos and thumbnails. Only upload media you have the rights to use." actions={
      <label className="btn-primary cursor-pointer">{busy ? <Spinner /> : <Upload className="h-4 w-4" />} Upload
        <input type="file" className="hidden" accept="image/*,video/*,audio/*,.ttf,.otf,.woff2" onChange={(e) => e.target.files?.[0] && run(async () => { await upload(e.target.files![0]); reload(); }, "Uploaded.")} />
      </label>}>
      <div className="mb-4 flex flex-wrap gap-1.5">{KINDS.map((k) => <button key={k} onClick={() => setKind(k)} className={`chip capitalize ${kind === k ? "bg-brand-500 text-white" : "bg-white/80 text-ink-soft"}`}>{k}</button>)}</div>
      {loading ? <Loading /> : null}
      {error ? <ErrorBox error={error} /> : null}
      {data && !data.length ? <Empty icon={ImageIcon} title="No media" text="Upload logos, product photos, videos and licensed music." /> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data?.map((m) => (
          <Card key={m.id} className="!p-2">
            <div className="aspect-square overflow-hidden rounded-xl bg-brand-50">
              {m.mime.startsWith("image") ? <img src={mediaUrl(m.id)} alt={m.filename} className="h-full w-full object-cover" /> : m.mime.startsWith("video") ? <video src={mediaUrl(m.id)} className="h-full w-full object-cover" muted preload="metadata" /> : <div className="grid h-full place-items-center p-2 text-center text-xs text-ink-soft">{m.mime}</div>}
            </div>
            <div className="mt-2 truncate text-xs font-semibold">{m.filename}</div>
            <div className="text-[11px] text-ink-faint">{m.kind} · {m.source} · {(m.size / 1e6).toFixed(1)} MB</div>
            <div className="text-[11px] text-ink-faint">{fmtDate(m.created_at)}</div>
            <div className="mt-1 flex gap-1">
              <a className="btn-ghost !p-1.5" href={mediaUrl(m.id, true)} aria-label="Download"><Download className="h-4 w-4" /></a>
              <button className="btn-ghost !p-1.5" aria-label="Delete" onClick={() => confirm(`Delete ${m.filename}?`) && run(async () => { await api(`/api/media/${m.id}`, { method: "DELETE" }); reload(); }, "Deleted.")}><Trash2 className="h-4 w-4" /></button>
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}
