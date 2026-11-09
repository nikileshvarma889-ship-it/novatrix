"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bookmark, BookmarkCheck, CheckCircle2, ChevronDown, Clock, ExternalLink, Layers, ListPlus, Plus, Trash2 } from "lucide-react";
import { Button, Card, Empty, Modal, Select, Skeleton, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { YouTubePlayer, type PlayerHandle } from "@/components/YouTubePlayer";
import { FlashcardPreview } from "@/components/FlashcardPreview";
import { NewPlaylist } from "@/components/NewPlaylist";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useData, must } from "@/hooks/useData";
import { fmtViews, upsertVideo, type Vid } from "@/lib/ytclient";
import { SUBJECTS, cn, formatDuration } from "@/lib/utils";
import { CHAPTERS } from "@/lib/syllabus";
import { fmt } from "@/lib/dates";

type Note = { id: string; timestamp_seconds: number | null; content: string; created_at: string };
type LibRow = { saved: boolean; last_position_seconds: number; watched: boolean; subject: string | null; chapter_id: string | null } | null;

export default function WatchPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const player = useRef<PlayerHandle>(null);
  const [info, setInfo] = useState<{ video: Vid; related: Vid[] } | null>(null);
  const [infoErr, setInfoErr] = useState<string | null>(null);
  const [lib, setLib] = useState<LibRow | undefined>(undefined);
  const [showDesc, setShowDesc] = useState(false);
  const [note, setNote] = useState("");
  const [stamp, setStamp] = useState(true);
  const [plOpen, setPlOpen] = useState(false);
  const [cards, setCards] = useState(false);
  const recorded = useRef(false);

  useEffect(() => {
    setInfo(null); setInfoErr(null); recorded.current = false;
    fetch(`/api/youtube/video?id=${id}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setInfo(j); }).catch((e) => setInfoErr(e.message));
    supabaseBrowser().from("videos").select("saved,last_position_seconds,watched,subject,chapter_id").eq("video_id", id).maybeSingle().then(({ data }) => setLib(data));
  }, [id]);

  const { data: notes, setData: setNotes } = useData(async () => must(await supabaseBrowser().from("video_notes").select("id,timestamp_seconds,content,created_at").eq("video_id", id).order("timestamp_seconds", { ascending: true, nullsFirst: true })) as Note[], [id]);

  const v = info?.video;
  const onProgress = useCallback(async (t: number, d: number) => {
    if (!v || !d) return;
    const watched = t / d > 0.92;
    await upsertVideo(v, { last_position_seconds: Math.floor(t), duration_seconds: Math.floor(d), last_watched_at: new Date().toISOString(), ...(watched ? { watched: true } : {}) });
    recorded.current = true;
  }, [v]);
  // record the visit as soon as metadata is known (history), even before progress ticks
  useEffect(() => { if (v && lib !== undefined && !recorded.current) { recorded.current = true; upsertVideo(v, { last_watched_at: new Date().toISOString() }); } }, [v, lib]);

  const toggleSave = async () => {
    if (!v) return;
    const saved = !lib?.saved;
    const { error } = await upsertVideo(v, { saved });
    if (error) return toast(error.message, "error");
    setLib((l) => ({ ...(l ?? { last_position_seconds: 0, watched: false, subject: null, chapter_id: null }), saved }));
    toast(saved ? "Saved to your library." : "Removed from saved.");
  };
  const setMeta = async (p: { subject?: string | null; chapter_id?: string | null }) => {
    if (!v) return;
    const { error } = await upsertVideo(v, p);
    if (error) return toast(error.message, "error");
    setLib((l) => ({ ...(l ?? { saved: false, last_position_seconds: 0, watched: false, subject: null, chapter_id: null }), ...p }));
  };
  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    const ts = stamp ? Math.floor(player.current?.time() ?? 0) : null;
    const { data, error } = await supabaseBrowser().from("video_notes").insert({ video_id: id, timestamp_seconds: ts, content: note.trim() }).select("id,timestamp_seconds,content,created_at").single();
    if (error) return toast(error.message, "error");
    if (v) upsertVideo(v, {});
    setNotes((n) => [...(n ?? []), data as Note].sort((a, b) => (a.timestamp_seconds ?? -1) - (b.timestamp_seconds ?? -1)));
    setNote("");
  };
  const delNote = async (n: Note) => {
    const { error } = await supabaseBrowser().from("video_notes").delete().eq("id", n.id);
    if (error) return toast(error.message, "error");
    setNotes((x) => x?.filter((y) => y.id !== n.id) ?? x);
  };

  return (
    <div className="space-y-4">
      <Link href="/youtube" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />YouTube Learning</Link>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          {lib === undefined ? <Skeleton className="aspect-video w-full" /> : <YouTubePlayer ref={player} videoId={id} start={lib && !lib.watched ? lib.last_position_seconds : 0} onProgress={onProgress} onEnded={() => v && upsertVideo(v, { watched: true, last_position_seconds: 0 })} />}
          {infoErr ? <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">{infoErr}</div> : !v ? <Skeleton className="h-24" /> : (
            <Card>
              <h1 className="text-lg font-semibold leading-snug">{v.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted"><span className="font-medium text-fg">{v.channel}</span>{v.views != null && <span>· {fmtViews(v.views)}</span>}{v.publishedAt && <span>· {fmt(v.publishedAt)}</span>}{v.duration ? <span>· {formatDuration(v.duration)}</span> : null}{lib?.watched && <span className="text-ok"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Watched</span>}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant={lib?.saved ? "secondary" : "primary"} onClick={toggleSave}>{lib?.saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{lib?.saved ? "Saved" : "Save"}</Button>
                <Button variant="secondary" onClick={() => setPlOpen(true)}><ListPlus className="h-4 w-4" />Add to playlist</Button>
                <Select value={lib?.subject ?? ""} onChange={(e) => setMeta({ subject: e.target.value || null, chapter_id: null })} className="h-10 w-40" aria-label="Subject"><option value="">Subject…</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
                {lib?.subject && <Select value={lib?.chapter_id ?? ""} onChange={(e) => setMeta({ chapter_id: e.target.value || null })} className="h-10 w-56" aria-label="Chapter"><option value="">Chapter…</option>{CHAPTERS.filter((c) => c.subject === lib.subject).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>}
                <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="ml-auto"><Button variant="ghost"><ExternalLink className="h-4 w-4" />YouTube</Button></a>
              </div>
              {v.description && (
                <div className="mt-4 rounded-xl bg-surface-2/60 p-3">
                  <p className={cn("whitespace-pre-wrap break-words text-sm text-muted", !showDesc && "line-clamp-3")}>{v.description}</p>
                  <button onClick={() => setShowDesc((s) => !s)} className="mt-1 flex items-center gap-1 text-xs font-medium text-brand">{showDesc ? "Show less" : "Show more"}<ChevronDown className={cn("h-3 w-3 transition", showDesc && "rotate-180")} /></button>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">My notes & timestamps</h2><Button size="sm" variant="ghost" onClick={() => setCards(true)} disabled={!notes?.length} title="Flashcards from your notes"><Layers className="h-4 w-4" />Flashcards</Button></div>
            <form onSubmit={addNote} className="space-y-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write what you learned at this point…" className="te min-h-[70px]" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} className="accent-[rgb(var(--brand))]" />Add current timestamp</label>
                <Button size="sm" type="submit" disabled={!note.trim()}><Plus className="h-4 w-4" />Add note</Button>
              </div>
            </form>
            <div className="scrollbar-thin mt-3 max-h-80 space-y-2 overflow-y-auto">
              {notes?.length ? notes.map((n) => (
                <div key={n.id} className="group flex items-start gap-2 rounded-xl border border-border/50 bg-surface-2/40 p-2.5">
                  {n.timestamp_seconds != null ? <button onClick={() => player.current?.seek(n.timestamp_seconds!)} className="shrink-0 rounded-md bg-brand/15 px-1.5 py-0.5 font-mono text-[11px] text-brand hover:bg-brand/25" title="Jump to this moment"><Clock className="mr-0.5 inline h-3 w-3" />{formatDuration(n.timestamp_seconds)}</button> : <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">note</span>}
                  <p className="te min-w-0 flex-1 whitespace-pre-wrap text-sm">{n.content}</p>
                  <button onClick={() => delNote(n)} className="text-subtle opacity-0 transition hover:text-danger group-hover:opacity-100" aria-label="Delete note"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )) : <p className="text-sm text-muted">Notes you add here stay private and link to the moment in the video.</p>}
            </div>
            <p className="mt-3 text-[11px] text-subtle">MEMORA doesn&apos;t watch or analyse the video itself — AI flashcards are made only from your own notes.</p>
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Related lessons</h2>
            {!info ? <Skeleton className="h-40" /> : info.related.length ? (
              <div className="space-y-2.5">{info.related.map((r) => (
                <Link key={r.id} href={`/youtube/watch/${r.id}`} className="flex gap-3 rounded-lg p-1 hover:bg-surface-2">
                  <div className="relative w-36 shrink-0"><img src={r.thumbnail} alt="" className="aspect-video w-full rounded-lg object-cover" />{r.duration ? <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 font-mono text-[10px] text-white">{formatDuration(r.duration)}</span> : null}</div>
                  <div className="min-w-0"><div className="line-clamp-2 text-[13px] font-medium leading-snug">{r.title}</div><div className="mt-0.5 truncate text-xs text-muted">{r.channel}</div></div>
                </Link>
              ))}</div>
            ) : <Empty title="No related lessons found" />}
          </Card>
        </div>
      </div>
      {v && <PlaylistPicker open={plOpen} onClose={() => setPlOpen(false)} v={v} />}
      <FlashcardPreview open={cards} onClose={() => setCards(false)} request={{ source: "video", id }} subject={lib?.subject ?? undefined} chapterId={lib?.chapter_id ?? undefined} deck={v?.title.slice(0, 80)} sourceKind="video" />
    </div>
  );
}

function PlaylistPicker({ open, onClose, v }: { open: boolean; onClose: () => void; v: Vid }) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const { data, reload } = useData(async () => (open ? (must(await supabaseBrowser().from("playlists").select("id,name,playlist_items(video_id)").order("created_at", { ascending: false })) as { id: string; name: string; playlist_items: { video_id: string }[] }[]) : null), [open]);
  const toggle = async (p: { id: string; playlist_items: { video_id: string }[] }) => {
    const sb = supabaseBrowser();
    const has = p.playlist_items.some((i) => i.video_id === v.id);
    const r = has ? await sb.from("playlist_items").delete().eq("playlist_id", p.id).eq("video_id", v.id)
      : await sb.from("playlist_items").insert({ playlist_id: p.id, video_id: v.id, title: v.title, channel_title: v.channel, thumbnail_url: v.thumbnail, position: p.playlist_items.length });
    if (r.error) return toast(r.error.message, "error");
    toast(has ? "Removed from playlist." : "Added to playlist.");
    reload();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add to playlist">
      <div className="space-y-2">
        {data?.length ? data.map((p) => {
          const has = p.playlist_items.some((i) => i.video_id === v.id);
          return <button key={p.id} onClick={() => toggle(p)} className={cn("flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm", has ? "border-brand/50 bg-brand/10" : "border-border hover:border-brand/30")}><span>{p.name}</span>{has ? <CheckCircle2 className="h-4 w-4 text-brand" /> : <Plus className="h-4 w-4 text-subtle" />}</button>;
        }) : <p className="text-sm text-muted">No playlists yet.</p>}
        <Button variant="secondary" className="w-full" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New playlist</Button>
      </div>
      <NewPlaylist open={creating} onClose={() => setCreating(false)} onSaved={() => reload()} />
    </Modal>
  );
}
