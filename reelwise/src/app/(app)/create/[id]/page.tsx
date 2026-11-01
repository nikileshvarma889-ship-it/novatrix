"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Copy, Download, ImageIcon, Pencil, Plus, RefreshCw, Send, Sparkles, Trash2, Wand2, X, XCircle } from "lucide-react";
import { api, Card, ErrorBox, Field, Loading, Modal, Notice, Page, Spinner, StatusBadge, fmtDate, mediaUrl, useAction, useApi } from "@/components/ui";
import type { Storyboard, Scene, CoverDesign } from "@/lib/ai/schemas";

type Pub = { id: string; platform: string; status: string; scheduled_at: string | null; published_at: string | null; external_url: string | null; error: string | null; account_name: string };
type Video = {
  id: string; title: string; instruction: string; status: string; style: string; aspect_ratio: string; render_progress: number; render_quality: string; error: string | null;
  storyboard: Storyboard | null; caption: string; hashtags: string[]; youtube_title: string; youtube_description: string; thumbnail_text: string;
  publish_kit: Kit | null;
  video_media_id: string | null; thumbnail_media_id: string | null; render_options: { voice?: string; music?: string; musicVolume?: number }; publications: Pub[]; approved_at: string | null;
};
type Kit = {
  status?: "generating" | "ready" | "failed"; error?: string | null; edited?: boolean; cover?: CoverDesign; notes?: string; generatedAt?: string;
  hashtags?: { tag: string; reach: "broad" | "niche" | "brand" }[]; chapters?: { at: number; title: string }[];
};
type Account = { id: string; platform: string; name: string; status: string };
type Voices = { options: { id: string; label: string }[] };

const busyStatus = (s: string) => s === "scripting" || s === "rendering";

function ApproveModal({ video, onClose, onDone }: { video: Video; onClose: () => void; onDone: () => void }) {
  const accounts = useApi<Account[]>("/api/accounts");
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [when, setWhen] = useState(() => new Date(Date.now() + 3600_000).toISOString().slice(0, 16));
  const [confirmed, setConfirmed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { busy, run } = useAction();
  const usable = accounts.data?.filter((a) => a.status === "connected") ?? [];
  const submit = () =>
    run(async () => {
      setErr(null);
      try {
        await api(`/api/videos/${video.id}/approve`, { method: "POST", json: { accountIds: picked, scheduleAt: mode === "later" ? new Date(when).toISOString() : null, confirm: true } });
        onDone();
      } catch (e) {
        setErr((e as Error).message);
        throw e;
      }
    }, mode === "now" ? "Approved. Rendering the 1080p version and publishing." : "Approved and scheduled.");
  return (
    <div className="space-y-5">
      <div>
        <div className="label">Publish to</div>
        {accounts.loading ? <Loading /> : null}
        {accounts.data && !usable.length ? (
          <Notice tone="warn">No connected accounts. <Link className="font-semibold underline" href="/accounts">Connect Instagram, Facebook or YouTube</Link> first.</Notice>
        ) : null}
        <div className="grid gap-2">
          {usable.map((a) => (
            <label key={a.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${picked.includes(a.id) ? "border-brand-400 bg-brand-50" : "border-brand-100 bg-white"}`}>
              <input type="checkbox" checked={picked.includes(a.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, a.id] : picked.filter((x) => x !== a.id))} />
              <span className="font-medium">{a.name}</span>
              <span className="ml-auto text-xs capitalize text-ink-soft">{a.platform}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <div className="label">When</div>
        <div className="grid grid-cols-2 gap-2">
          {(["now", "later"] as const).map((m) => (
            <button key={m} className={m === mode ? "btn-primary" : "btn-outline"} onClick={() => setMode(m)}>{m === "now" ? "Publish now" : "Schedule"}</button>
          ))}
        </div>
        {mode === "later" ? <input type="datetime-local" className="input mt-2" value={when} onChange={(e) => setWhen(e.target.value)} /> : null}
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I have watched this video and approve publishing it to the selected accounts.
      </label>
      {err ? <ErrorBox error={err} /> : null}
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={busy || !picked.length || !confirmed} onClick={submit}>{busy ? <Spinner /> : <Send className="h-4 w-4" />} Approve & publish</button>
      </div>
    </div>
  );
}

function SceneCard({ scene, index, onRegenerate, onEdit, disabled }: { scene: Scene; index: number; onRegenerate: (note: string) => void; onEdit: (s: Scene) => void; disabled: boolean }) {
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(scene);
  useEffect(() => setDraft(scene), [scene]);
  return (
    <div className="rounded-2xl bg-white/80 p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">{index + 1}</span>
        <span className="font-semibold">{scene.heading || scene.kind}</span>
        <span className="chip ml-auto bg-slate-100 text-slate-600">{scene.kind.replace(/_/g, " ")} · {scene.durationSec}s</span>
      </div>
      {edit ? (
        <div className="mt-3 space-y-2">
          <input className="input" value={draft.heading} onChange={(e) => setDraft({ ...draft, heading: e.target.value })} placeholder="On-screen headline" />
          <input className="input" value={draft.subheading} onChange={(e) => setDraft({ ...draft, subheading: e.target.value })} placeholder="Supporting line" />
          <textarea className="input min-h-[70px]" value={draft.voiceover} onChange={(e) => setDraft({ ...draft, voiceover: e.target.value })} placeholder="Voiceover" />
          <div className="flex gap-2">
            <button className="btn-primary !py-2 text-xs" disabled={disabled} onClick={() => { onEdit(draft); setEdit(false); }}>Save & re-render</button>
            <button className="btn-ghost !py-2 text-xs" onClick={() => setEdit(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {scene.subheading ? <p className="mt-1 text-sm text-ink-soft">{scene.subheading}</p> : null}
          {scene.voiceover ? <p className="mt-2 rounded-xl bg-brand-50/70 px-3 py-2 text-sm italic text-ink-soft">“{scene.voiceover}”</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <input className="input !py-2 text-sm sm:flex-1" placeholder="Describe a change for this scene…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-outline !py-2 text-xs" disabled={disabled || note.trim().length < 3} onClick={() => { onRegenerate(note); setNote(""); }}><Wand2 className="h-3.5 w-3.5" /> Regenerate scene</button>
            <button className="btn-ghost !py-2 text-xs" disabled={disabled} onClick={() => setEdit(true)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
          </div>
        </>
      )}
    </div>
  );
}

const REACH: Record<string, { label: string; cls: string }> = {
  broad: { label: "Broad reach", cls: "bg-brand-50 text-brand-700 ring-brand-200" },
  niche: { label: "Niche / community", cls: "bg-lilac-100 text-[#6a4fd6] ring-lilac-300" },
  brand: { label: "Brand", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
};

const Count = ({ n, max }: { n: number; max: number }) => <span className={`text-[11px] ${n > max ? "text-red-600" : "text-ink-faint"}`}>{n}/{max}</span>;

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })}>
      <Copy className="h-3 w-3" /> {ok ? "Copied" : "Copy"}
    </button>
  );
}

/** Title, description, caption, hashtags and cover - written and designed by Claude from the finished video. */
function PublishKitCard({ v, reload }: { v: Video; reload: () => void }) {
  const kit = v.publish_kit ?? {};
  const generating = kit.status === "generating";
  const published = v.publications.some((p) => ["publishing", "published"].includes(p.status));
  const { busy, run } = useAction();
  const [t, setT] = useState({ youtube_title: "", youtube_description: "", caption: "" });
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [note, setNote] = useState("");
  const [coverOpen, setCoverOpen] = useState(false);
  const scenes = v.storyboard?.scenes ?? [];
  const blank: CoverDesign = { sceneIndex: 0, headline: v.thumbnail_text || v.title, highlightWord: "", subline: "", layout: "bottom", accentColor: "#5b6cff" };
  const [cover, setCover] = useState<CoverDesign>(kit.cover ?? blank);
  useEffect(() => {
    setT({ youtube_title: v.youtube_title ?? "", youtube_description: v.youtube_description ?? "", caption: v.caption ?? "" });
    setTags(v.hashtags ?? []);
    setCover(v.publish_kit?.cover ?? blank);
    // reset when Claude delivers a new kit or the video changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.id, kit.generatedAt, kit.status, v.status]);
  const reach = new Map((kit.hashtags ?? []).map((h) => [h.tag.toLowerCase(), h.reach]));
  const grouped = (["broad", "niche", "brand", "other"] as const).map((r) => ({ r, items: tags.filter((x) => (reach.get(x.toLowerCase()) ?? "other") === r) })).filter((g) => g.items.length);
  const ready = Boolean(v.video_media_id) && !busyStatus(v.status);
  const ask = () => run(async () => { await api(`/api/videos/${v.id}/publish-kit`, { method: "POST", json: { note: note || undefined } }); setNote(""); reload(); }, "Claude is watching the video and writing a new version.");
  const save = () => run(async () => { await api(`/api/videos/${v.id}`, { method: "PATCH", json: { ...t, hashtags: tags } }); reload(); }, "Saved. Your edits will be used when publishing.");
  const saveCover = () => run(async () => { await api(`/api/videos/${v.id}/publish-kit`, { method: "PUT", json: cover }); setCoverOpen(false); reload(); }, "Updating the cover…");
  const addTag = () => {
    const x = newTag.replace(/^#+/, "").replace(/\s+/g, "");
    if (x && !tags.some((y) => y.toLowerCase() === x.toLowerCase())) setTags([...tags, x]);
    setNewTag("");
  };
  const hashtagLine = tags.map((x) => `#${x}`).join(" ");
  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <div className="font-display text-lg font-bold">Title, description, hashtags & cover</div>
        {generating ? <span className="chip bg-brand-50 text-brand-700"><Spinner /> Claude is working</span>
          : kit.status === "ready" ? <span className="chip bg-emerald-50 text-emerald-700"><Sparkles className="h-3 w-3" /> {kit.edited ? "Made by Claude, edited by you" : "Made by Claude"}</span> : null}
      </div>
      <p className="muted mb-4">Claude watches the finished video (one frame from every scene plus the script) and writes the YouTube title and description, the Instagram/Facebook caption and the hashtags, then designs the cover. Everything here is what gets published. Edit anything before you approve.</p>

      {generating ? (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-brand-50 to-lilac-50 px-4 py-3 text-sm text-ink-soft">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}><Sparkles className="h-5 w-5 text-brand-500" /></motion.div>
          Claude is watching your video and writing the title, description, hashtags and cover…
        </div>
      ) : null}
      {kit.status === "failed" && kit.error ? <div className="mb-4"><ErrorBox error={kit.error} /></div> : null}
      {!ready && !generating ? <Notice>These appear automatically once the preview has rendered.</Notice> : null}
      {kit.notes && !generating ? <p className="mb-4 rounded-xl bg-white/70 px-3 py-2 text-xs text-ink-soft"><b>Claude&apos;s angle:</b> {kit.notes}</p> : null}

      <div className="grid gap-5 md:grid-cols-[1fr_220px]">
        <fieldset className="space-y-3" disabled={generating || published}>
          <Field label="YouTube title">
            <input className="input" maxLength={100} value={t.youtube_title} onChange={(e) => setT({ ...t, youtube_title: e.target.value })} />
            <div className="mt-1 flex justify-between"><Count n={t.youtube_title.length} max={100} /><CopyBtn text={t.youtube_title} /></div>
          </Field>
          <Field label="YouTube description">
            <textarea className="input min-h-[130px]" value={t.youtube_description} onChange={(e) => setT({ ...t, youtube_description: e.target.value })} />
            <div className="mt-1 flex justify-between"><Count n={t.youtube_description.length} max={5000} /><CopyBtn text={[t.youtube_description, hashtagLine].filter(Boolean).join("\n\n")} /></div>
          </Field>
          {kit.chapters?.length ? <p className="-mt-1 text-[11px] text-ink-faint">Includes {kit.chapters.length} YouTube chapters built from the video&apos;s real scene timings.</p> : null}
          <Field label="Instagram / Facebook caption">
            <textarea className="input min-h-[110px]" value={t.caption} onChange={(e) => setT({ ...t, caption: e.target.value })} />
            <div className="mt-1 flex justify-between"><Count n={t.caption.length + hashtagLine.length + 2} max={2200} /><CopyBtn text={[t.caption, hashtagLine].filter(Boolean).join("\n\n")} /></div>
          </Field>
          <div>
            <div className="label flex items-center justify-between">Hashtags <span className="font-normal normal-case text-ink-faint">{tags.length} · Instagram allows 30</span></div>
            <div className="space-y-2">
              {grouped.map((g) => (
                <div key={g.r}>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{REACH[g.r]?.label ?? "Your tags"}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((x) => (
                      <span key={x} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${REACH[g.r]?.cls ?? "bg-white text-ink-soft ring-ink/10"}`}>
                        #{x}
                        <button type="button" aria-label={`Remove #${x}`} onClick={() => setTags(tags.filter((y) => y !== x))}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <input className="input !py-2 text-sm" placeholder="Add a hashtag" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} />
                <button type="button" className="btn-outline !py-2" onClick={addTag}><Plus className="h-4 w-4" /></button>
                <CopyBtn text={hashtagLine} />
              </div>
              <p className="text-[11px] text-ink-faint">Claude picks tags the way people in this niche search: broad, niche and brand. It has no live trend data, so no tag is guaranteed to go viral.</p>
            </div>
          </div>
        </fieldset>

        <div>
          <div className="label">Cover</div>
          <div className={`overflow-hidden rounded-xl bg-brand-50 shadow-soft ${v.aspect_ratio === "9:16" ? "aspect-[9/16]" : v.aspect_ratio === "1:1" ? "aspect-square" : "aspect-video"}`}>
            {v.thumbnail_media_id ? <img key={v.thumbnail_media_id} src={mediaUrl(v.thumbnail_media_id)} alt="Cover" className={`h-full w-full object-cover ${generating ? "opacity-50" : ""}`} /> : <div className="grid h-full place-items-center text-xs text-ink-faint"><ImageIcon className="h-6 w-6" /></div>}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">Used as the YouTube thumbnail and the Facebook video thumbnail. Instagram uses the same frame of the video as the Reel cover.</p>
          <button type="button" className="btn-outline mt-2 w-full !py-2 text-xs" disabled={!ready || generating || published || !scenes.length} onClick={() => setCoverOpen(!coverOpen)}><Pencil className="h-3.5 w-3.5" /> Edit cover</button>
          {coverOpen ? (
            <div className="mt-3 space-y-2 rounded-xl bg-white/80 p-3">
              <Field label="Headline"><input className="input !py-2 text-sm" maxLength={48} value={cover.headline} onChange={(e) => setCover({ ...cover, headline: e.target.value })} /></Field>
              <Field label="Highlighted word"><input className="input !py-2 text-sm" value={cover.highlightWord} onChange={(e) => setCover({ ...cover, highlightWord: e.target.value })} /></Field>
              <Field label="Sub line"><input className="input !py-2 text-sm" maxLength={48} value={cover.subline} onChange={(e) => setCover({ ...cover, subline: e.target.value })} /></Field>
              <Field label="Background scene">
                <select className="input !py-2 text-sm" value={cover.sceneIndex} onChange={(e) => setCover({ ...cover, sceneIndex: Number(e.target.value) })}>
                  {scenes.map((s, i) => <option key={i} value={i}>{i + 1}. {s.heading || s.kind}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Text position">
                  <select className="input !py-2 text-sm" value={cover.layout} onChange={(e) => setCover({ ...cover, layout: e.target.value as CoverDesign["layout"] })}>
                    <option value="top">Top</option><option value="center">Centre</option><option value="bottom">Bottom</option>
                  </select>
                </Field>
                <Field label="Accent"><input type="color" className="input h-[38px] !p-1" value={cover.accentColor} onChange={(e) => setCover({ ...cover, accentColor: e.target.value })} /></Field>
              </div>
              <button type="button" className="btn-primary w-full !py-2 text-xs" disabled={busy} onClick={saveCover}>{busy ? <Spinner /> : null} Update cover</button>
            </div>
          ) : null}
        </div>
      </div>

      {published ? <div className="mt-4"><Notice>This video has been published, so its text and cover are locked.</Notice></div> : (
        <div className="mt-5 flex flex-col gap-3 border-t border-ink/5 pt-4 md:flex-row md:items-center">
          <input className="input !py-2 text-sm md:flex-1" placeholder="Optional note for Claude, e.g. “more playful”, “target Telugu audience”" value={note} onChange={(e) => setNote(e.target.value)} disabled={!ready || generating} />
          <button className="btn-outline" disabled={busy || !ready || generating} onClick={ask}><Wand2 className="h-4 w-4" /> {kit.status ? "Rewrite with Claude" : "Write with Claude"}</button>
          <button className="btn-primary" disabled={busy || generating} onClick={save}>Save my edits</button>
        </div>
      )}
    </Card>
  );
}

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: v, error, loading, reload } = useApi<Video>(`/api/videos/${id}`, 4000);
  const voices = useApi<Voices>("/api/voices");
  const [approve, setApprove] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const { busy, run } = useAction();
  useEffect(() => {
    if (v) {
      setInstruction(v.instruction);
    }
    // only when the server copy changes identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.id, v?.status]);
  if (loading) return <Page title="Video"><Loading /></Page>;
  if (error || !v) return <Page title="Video"><ErrorBox error={error ?? "Not found"} /></Page>;
  const working = busyStatus(v.status);
  const patch = (json: unknown, ok: string) => run(async () => { await api(`/api/videos/${v.id}`, { method: "PATCH", json }); reload(); }, ok);
  const sb = v.storyboard;
  const vertical = v.aspect_ratio === "9:16";
  return (
    <Page
      title={v.title}
      subtitle={`${v.style === "cinematic3d" ? "Cinematic 3D" : "Promotional"} · ${v.aspect_ratio} · ${v.render_quality === "final" ? "1080p final" : "preview quality"}`}
      actions={<Link href="/create" className="btn-ghost"><ArrowLeft className="h-4 w-4" /> All videos</Link>}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card className="!p-3">
            <div className={`relative mx-auto overflow-hidden rounded-2xl bg-ink ${vertical ? "max-w-[360px] aspect-[9/16]" : v.aspect_ratio === "1:1" ? "aspect-square" : "aspect-video"}`}>
              {v.video_media_id && !working ? (
                <video key={v.video_media_id} src={mediaUrl(v.video_media_id)} poster={mediaUrl(v.thumbnail_media_id)} controls playsInline className="h-full w-full bg-black object-contain" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand-500/90 to-lilac-500/90 p-6 text-center text-white">
                  {v.status === "failed" ? <XCircle className="h-10 w-10" /> : <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}><RefreshCw className="h-10 w-10" /></motion.div>}
                  <div className="font-display text-lg font-bold">{v.status === "scripting" ? "Claude is writing the script…" : v.status === "rendering" ? "Rendering your video…" : v.status === "failed" ? "Something went wrong" : "Preparing…"}</div>
                  {v.status === "rendering" ? (
                    <div className="h-2 w-48 overflow-hidden rounded-full bg-white/30"><div className="h-full bg-white transition-all" style={{ width: `${Math.max(3, v.render_progress * 100)}%` }} /></div>
                  ) : null}
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
              <StatusBadge status={v.status} />
              {v.approved_at ? <span className="text-xs text-ink-soft">Approved {fmtDate(v.approved_at)}</span> : null}
              <div className="flex-1" />
              {v.video_media_id ? <a className="btn-outline !py-2 text-xs" href={mediaUrl(v.video_media_id, true)}><Download className="h-3.5 w-3.5" /> Download MP4</a> : null}
            </div>
          </Card>
          {v.error ? <div className="mt-4"><ErrorBox error={v.error} /></div> : null}
          {v.status === "failed" ? <button className="btn-outline mt-3 w-full" disabled={busy} onClick={() => run(async () => { await api(`/api/videos/${v.id}/render`, { method: "POST" }); reload(); }, "Retrying.")}><RefreshCw className="h-4 w-4" /> Try again</button> : null}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="btn-primary !py-3.5" disabled={working || !["ready", "approved"].includes(v.status) || v.publish_kit?.status === "generating"} title={v.publish_kit?.status === "generating" ? "Claude is still writing the title, hashtags and cover" : undefined} onClick={() => setApprove(true)}><CheckCircle2 className="h-5 w-5" /> APPROVE & PUBLISH</button>
            <button className="btn-outline !py-3.5" disabled={working} onClick={() => setEditOpen(true)}><Pencil className="h-5 w-5" /> EDIT VIDEO</button>
          </div>
          <div className="mt-2 flex gap-2">
            <button className="btn-ghost flex-1 text-xs" disabled={working || v.status === "rejected"} onClick={() => confirm("Reject this video? Pending posts will be cancelled.") && run(async () => { await api(`/api/videos/${v.id}/reject`, { method: "POST" }); reload(); }, "Video rejected.")}><XCircle className="h-4 w-4" /> Reject</button>
            <button className="btn-ghost flex-1 text-xs" onClick={() => confirm("Delete this video permanently?") && run(async () => { await api(`/api/videos/${v.id}`, { method: "DELETE" }); router.push("/create"); }, "Deleted.")}><Trash2 className="h-4 w-4" /> Delete</button>
          </div>

          {v.publications.length ? (
            <Card className="mt-4">
              <div className="mb-3 font-display font-bold">Publishing status</div>
              <ul className="space-y-2">
                {v.publications.map((p) => (
                  <li key={p.id} className="rounded-xl bg-white/80 px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2"><span className="font-medium">{p.account_name}</span><span className="text-xs capitalize text-ink-faint">{p.platform}</span><span className="ml-auto"><StatusBadge status={p.status} /></span></div>
                    <div className="mt-1 text-xs text-ink-soft">{p.published_at ? `Published ${fmtDate(p.published_at)}` : p.scheduled_at ? `Scheduled for ${fmtDate(p.scheduled_at)}` : ""}</div>
                    {p.external_url ? <a className="text-xs font-semibold text-brand-600" href={p.external_url} target="_blank" rel="noreferrer">View post</a> : null}
                    {p.error ? <div className="mt-1 text-xs text-red-600">{p.error}</div> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6 lg:col-span-3">
          <Card>
            <div className="mb-2 font-display text-lg font-bold">Instruction</div>
            <p className="whitespace-pre-wrap text-sm text-ink-soft">{v.instruction}</p>
          </Card>
          {sb ? (
            <Card>
              <div className="mb-1 font-display text-lg font-bold">Script & scenes</div>
              {sb.hook ? <p className="muted mb-3">Hook: “{sb.hook}”</p> : null}
              <div className="space-y-3">
                {sb.scenes.map((s, i) => (
                  <SceneCard
                    key={s.id + i}
                    scene={s}
                    index={i}
                    disabled={working || busy}
                    onRegenerate={(note) => run(async () => { await api(`/api/videos/${v.id}/scene`, { method: "POST", json: { sceneId: s.id, note } }); reload(); }, "Scene rewritten. Re-rendering.")}
                    onEdit={(scene) => patch({ storyboard: { ...sb, scenes: sb.scenes.map((x, j) => (j === i ? scene : x)) } }, "Scene updated. Re-rendering.")}
                  />
                ))}
              </div>
            </Card>
          ) : null}
          <PublishKitCard v={v} reload={reload} />
        </div>
      </div>

      <Modal open={approve} onClose={() => setApprove(false)} title="Approve & publish">
        <ApproveModal video={v} onClose={() => setApprove(false)} onDone={() => { setApprove(false); reload(); }} />
      </Modal>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit video" wide>
        <div className="space-y-5">
          <Field label="Video instructions" hint="Regenerating writes a new script and renders again.">
            <textarea className="input min-h-[120px]" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
          </Field>
          <button className="btn-primary" disabled={busy || instruction.trim().length < 10} onClick={() => run(async () => { await api(`/api/videos/${v.id}/regenerate`, { method: "POST", json: { instruction } }); setEditOpen(false); reload(); }, "Regenerating the video.")}><Wand2 className="h-4 w-4" /> Regenerate with new instructions</button>
          <div className="grid gap-4 border-t border-brand-100 pt-5 sm:grid-cols-2">
            <Field label="Voiceover" hint="Telugu videos always use the ElevenLabs Bunty voice.">
              <select className="input" defaultValue={v.render_options.voice ?? "warm-male"} onChange={(e) => patch({ render_options: { voice: e.target.value } }, "Voice changed. Re-rendering.")}>
                {voices.data?.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Music">
              <select className="input" defaultValue={v.render_options.music ?? ""} onChange={(e) => patch({ render_options: { music: e.target.value || undefined } }, "Music changed. Re-rendering.")}>
                <option value="">Brand music / AI mood</option>
                {["upbeat", "inspiring", "calm", "dramatic", "corporate"].map((m) => <option key={m} value={`mood:${m}`}>Built-in {m}</option>)}
                <option value="none">No music</option>
              </select>
            </Field>
          </div>
          <p className="text-xs text-ink-faint">To change on-screen text or narration for one scene, use Edit or Regenerate on that scene. Any change resets approval.</p>
        </div>
      </Modal>
    </Page>
  );
}
