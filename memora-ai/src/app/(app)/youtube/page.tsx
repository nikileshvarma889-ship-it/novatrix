"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Bookmark, Clock, History, ListVideo, PlayCircle, Plus, Search, Trash2, Youtube } from "lucide-react";
import { Badge, Button, Card, Empty, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useData, must } from "@/hooks/useData";
import { NewPlaylist } from "@/components/NewPlaylist";
import { CATEGORIES, fmtViews, type Vid } from "@/lib/ytclient";
import { SUBJECTS, cn, formatDuration, subjectName } from "@/lib/utils";
import { relative } from "@/lib/dates";

type Lib = { video_id: string; title: string; channel_title: string; thumbnail_url: string | null; saved: boolean; last_position_seconds: number; duration_seconds: number | null; watched: boolean; last_watched_at: string | null; subject: string | null };
type Playlist = { id: string; name: string; description: string; subject: string | null; created_at: string; playlist_items: { video_id: string; title: string; channel_title: string; thumbnail_url: string | null; position: number }[] };
type LibTab = "continue" | "recent" | "saved" | "playlists" | "subjects";

function YoutubeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<Vid[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [libTab, setLibTab] = useState<LibTab>("continue");
  const [newPl, setNewPl] = useState(false);

  const search = async (query: string, page?: string) => {
    if (!query.trim()) return;
    setSearching(true); setError(null);
    try {
      const r = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}${page ? `&page=${page}` : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setResults((x) => (page && x ? [...x, ...j.videos] : j.videos)); setNext(j.nextPageToken);
    } catch (e) { setError(e instanceof Error ? e.message : "Search failed."); if (!page) setResults(null); }
    finally { setSearching(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const q0 = params.get("q"); if (q0) search(q0); }, []);

  const { data: lib, loading: libLoading, reload: reloadLib } = useData(async () => must(await supabaseBrowser().from("videos").select("*").order("last_watched_at", { ascending: false, nullsFirst: false }).limit(300)) as Lib[]);
  const { data: playlists, reload: reloadPl } = useData(async () => must(await supabaseBrowser().from("playlists").select("*, playlist_items(video_id,title,channel_title,thumbnail_url,position)").order("created_at", { ascending: false })) as Playlist[]);

  const continueList = (lib ?? []).filter((v) => !v.watched && v.last_position_seconds > 20 && v.last_watched_at);
  const recent = (lib ?? []).filter((v) => v.last_watched_at);
  const saved = (lib ?? []).filter((v) => v.saved);
  const delPl = async (id: string) => {
    if (!confirm("Delete this playlist?")) return;
    const { error } = await supabaseBrowser().from("playlists").delete().eq("id", id);
    if (error) toast(error.message, "error"); else reloadPl();
  };
  const removeHistory = async (v: Lib) => {
    const sb = supabaseBrowser();
    const r = v.saved ? await sb.from("videos").update({ last_watched_at: null, last_position_seconds: 0, watched: false }).eq("video_id", v.video_id) : await sb.from("videos").delete().eq("video_id", v.video_id);
    if (r.error) toast(r.error.message, "error"); else reloadLib();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="YouTube Learning" sub="Find and watch lessons without leaving MEMORA. Videos play in the official YouTube player." icon={<Youtube className="h-5 w-5" />} />
      <form onSubmit={(e) => { e.preventDefault(); setCat(null); router.replace(`/youtube?q=${encodeURIComponent(q)}`, { scroll: false }); search(q); }} className="flex gap-2">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons, e.g. “projectile motion numericals”" className="input h-11 pl-10" /></div>
        <Button type="submit" className="h-11" loading={searching && !next}>Search</Button>
      </form>
      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {CATEGORIES.map((c) => <button key={c.id} onClick={() => { setCat(c.id); setQ(c.q); search(c.q); }} className={cn("whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] transition", cat === c.id ? "border-brand/50 bg-brand/15 text-brand" : "border-border text-muted hover:text-fg")}>{c.label}</button>)}
      </div>

      {error && <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">{error}</div>}
      {(results || searching) && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted">{searching && !results ? "Searching…" : `Results${cat ? ` · ${CATEGORIES.find((c) => c.id === cat)?.label}` : ""}`}</h2>
          {searching && !results ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-video" />)}</div> : results?.length ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{results.map((v) => <VideoCard key={v.id} v={v} />)}</div>
              {next && <div className="mt-4 flex justify-center"><Button variant="secondary" onClick={() => search(q, next)} loading={searching}>Load more</Button></div>}
            </>
          ) : <Empty icon={<Search className="h-5 w-5" />} title="No embeddable videos found" text="Try different keywords." />}
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">My video library</h2>
          <Tabs value={libTab} onChange={setLibTab} tabs={[{ id: "continue", label: `Continue (${continueList.length})` }, { id: "recent", label: "Recently watched" }, { id: "saved", label: `Saved (${saved.length})` }, { id: "playlists", label: "Playlists" }, { id: "subjects", label: "By subject" }]} />
        </div>
        {libLoading ? <Skeleton className="h-40" /> : (
          <>
            {libTab === "continue" && (continueList.length ? <LibGrid list={continueList} progress /> : <Empty icon={<Clock className="h-5 w-5" />} title="Nothing to continue" text="Videos you start watching will appear here with your position saved." />)}
            {libTab === "recent" && (recent.length ? <LibGrid list={recent} onRemove={removeHistory} /> : <Empty icon={<History className="h-5 w-5" />} title="No watch history yet" />)}
            {libTab === "saved" && (saved.length ? <LibGrid list={saved} /> : <Empty icon={<Bookmark className="h-5 w-5" />} title="No saved videos" text="Tap Save on any video to keep it here." />)}
            {libTab === "playlists" && (
              <div className="space-y-4">
                <Button size="sm" onClick={() => setNewPl(true)}><Plus className="h-4 w-4" />New playlist</Button>
                {playlists?.length ? playlists.map((p) => (
                  <Card key={p.id}>
                    <div className="mb-3 flex items-start justify-between gap-2"><div><h3 className="font-semibold">{p.name}</h3><p className="text-xs text-muted">{p.playlist_items.length} video{p.playlist_items.length === 1 ? "" : "s"}{p.subject ? ` · ${subjectName(p.subject)}` : ""}{p.description ? ` · ${p.description}` : ""}</p></div><button onClick={() => delPl(p.id)} className="rounded-lg p-1.5 text-muted hover:text-danger" aria-label="Delete playlist"><Trash2 className="h-4 w-4" /></button></div>
                    {p.playlist_items.length ? <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-1">{[...p.playlist_items].sort((a, b) => a.position - b.position).map((it) => (
                      <Link key={it.video_id} href={`/youtube/watch/${it.video_id}?pl=${p.id}`} className="w-48 shrink-0"><img src={it.thumbnail_url ?? ""} alt="" className="aspect-video w-full rounded-lg object-cover" /><div className="mt-1 line-clamp-2 text-xs font-medium">{it.title}</div></Link>
                    ))}</div> : <p className="text-sm text-muted">Add videos with “Add to playlist” on the player page.</p>}
                  </Card>
                )) : <Empty icon={<ListVideo className="h-5 w-5" />} title="No playlists yet" />}
              </div>
            )}
            {libTab === "subjects" && (
              <div className="space-y-5">
                {[...SUBJECTS.map((s) => ({ id: s.id as string | null, name: s.name })), { id: null, name: "Unsorted" }].map((s) => {
                  const vids = (lib ?? []).filter((v) => v.subject === s.id && (v.saved || v.last_watched_at));
                  return vids.length ? <div key={s.name}><h3 className="mb-2 text-sm font-semibold">{s.name} <span className="font-normal text-muted">({vids.length})</span></h3><LibGrid list={vids} /></div> : null;
                })}
                {!(lib ?? []).length && <Empty icon={<Youtube className="h-5 w-5" />} title="No videos yet" text="Set a subject on the player page to organise videos here." />}
              </div>
            )}
          </>
        )}
      </section>
      <NewPlaylist open={newPl} onClose={() => setNewPl(false)} onSaved={reloadPl} />
    </div>
  );
}

function VideoCard({ v }: { v: Vid }) {
  return (
    <Link href={`/youtube/watch/${v.id}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-surface-2">
        <img src={v.thumbnail} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
        <div className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/30"><PlayCircle className="h-12 w-12 text-white opacity-0 transition group-hover:opacity-100" /></div>
        {v.duration ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white">{formatDuration(v.duration)}</span> : null}
      </div>
      <div className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{v.title}</div>
      <div className="mt-0.5 text-xs text-muted">{v.channel}{v.views != null ? ` · ${fmtViews(v.views)}` : ""}</div>
    </Link>
  );
}

function LibGrid({ list, progress, onRemove }: { list: Lib[]; progress?: boolean; onRemove?: (v: Lib) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {list.map((v) => (
        <div key={v.video_id} className="group relative">
          <Link href={`/youtube/watch/${v.video_id}`} className="block">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-surface-2">
              {v.thumbnail_url && <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
              {(progress || v.last_position_seconds > 20) && v.duration_seconds ? <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50"><div className="h-full bg-danger" style={{ width: `${v.watched ? 100 : Math.min(100, (v.last_position_seconds / v.duration_seconds) * 100)}%` }} /></div> : null}
              {v.watched && <Badge tone="ok" className="absolute left-2 top-2">Watched</Badge>}
            </div>
            <div className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{v.title}</div>
            <div className="mt-0.5 text-xs text-muted">{v.channel_title}{v.last_watched_at ? ` · ${relative(v.last_watched_at)}` : ""}{progress && v.duration_seconds ? ` · ${formatDuration(v.duration_seconds - v.last_position_seconds)} left` : ""}</div>
          </Link>
          {onRemove && <button onClick={() => onRemove(v)} className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remove from history" title="Remove from history"><Trash2 className="h-3.5 w-3.5" /></button>}
        </div>
      ))}
    </div>
  );
}

export default function YoutubePage() {
  return <Suspense><YoutubeInner /></Suspense>;
}
