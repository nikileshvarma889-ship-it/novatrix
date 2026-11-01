"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Download, Pencil, RefreshCw, Send, Trash2, Wand2, XCircle } from "lucide-react";
import { api, Card, ErrorBox, Field, Loading, Modal, Notice, Page, Spinner, StatusBadge, fmtDate, mediaUrl, useAction, useApi } from "@/components/ui";
import type { Storyboard, Scene } from "@/lib/ai/schemas";

type Pub = { id: string; platform: string; status: string; scheduled_at: string | null; published_at: string | null; external_url: string | null; error: string | null; account_name: string };
type Video = {
  id: string; title: string; instruction: string; status: string; style: string; aspect_ratio: string; render_progress: number; render_quality: string; error: string | null;
  storyboard: Storyboard | null; caption: string; hashtags: string[]; youtube_title: string; youtube_description: string; thumbnail_text: string;
  video_media_id: string | null; thumbnail_media_id: string | null; render_options: { voice?: string; music?: string; musicVolume?: number }; publications: Pub[]; approved_at: string | null;
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

export default function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: v, error, loading, reload } = useApi<Video>(`/api/videos/${id}`, 4000);
  const voices = useApi<Voices>("/api/voices");
  const [approve, setApprove] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [text, setText] = useState({ caption: "", hashtags: "", youtube_title: "", youtube_description: "", thumbnail_text: "", title: "" });
  const [instruction, setInstruction] = useState("");
  const { busy, run } = useAction();
  useEffect(() => {
    if (v) {
      setText({ caption: v.caption, hashtags: v.hashtags.map((h) => `#${h}`).join(" "), youtube_title: v.youtube_title, youtube_description: v.youtube_description, thumbnail_text: v.thumbnail_text, title: v.title });
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
            <button className="btn-primary !py-3.5" disabled={working || !["ready", "approved"].includes(v.status)} onClick={() => setApprove(true)}><CheckCircle2 className="h-5 w-5" /> APPROVE & PUBLISH</button>
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
          <Card>
            <div className="mb-3 font-display text-lg font-bold">Captions, hashtags & thumbnail</div>
            <div className="grid gap-4 md:grid-cols-[1fr_200px]">
              <div className="space-y-3">
                <Field label="Instagram / Facebook caption"><textarea className="input min-h-[110px]" value={text.caption} onChange={(e) => setText({ ...text, caption: e.target.value })} /></Field>
                <Field label="Hashtags"><input className="input" value={text.hashtags} onChange={(e) => setText({ ...text, hashtags: e.target.value })} /></Field>
                <Field label="YouTube title"><input className="input" maxLength={100} value={text.youtube_title} onChange={(e) => setText({ ...text, youtube_title: e.target.value })} /></Field>
                <Field label="YouTube description"><textarea className="input min-h-[90px]" value={text.youtube_description} onChange={(e) => setText({ ...text, youtube_description: e.target.value })} /></Field>
              </div>
              <div>
                <div className="label">Thumbnail</div>
                {v.thumbnail_media_id ? <img src={mediaUrl(v.thumbnail_media_id)} alt="Thumbnail" className="w-full rounded-xl shadow-soft" /> : <div className="grid aspect-video place-items-center rounded-xl bg-brand-50 text-xs text-ink-faint">After render</div>}
                <Field label="Thumbnail text"><input className="input mt-2" value={text.thumbnail_text} onChange={(e) => setText({ ...text, thumbnail_text: e.target.value })} /></Field>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() =>
                  patch(
                    { ...text, hashtags: text.hashtags.split(/[\s,]+/).map((h) => h.replace(/^#/, "")).filter(Boolean) },
                    "Text saved.",
                  )
                }
              >
                Save text
              </button>
            </div>
          </Card>
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
