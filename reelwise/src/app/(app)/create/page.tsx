"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, Recycle, Sparkles, Wand2 } from "lucide-react";
import { api, Card, Empty, ErrorBox, Field, Loading, Modal, Notice, Page, Spinner, StatusBadge, fmtDate, mediaUrl, useAction, useApi } from "@/components/ui";

type Brand = { id: string; name: string; video_style: string; aspect_ratio: string; duration_sec: number; language: string };
type Video = { id: string; title: string; status: string; render_progress: number; thumbnail_media_id: string | null; created_at: string; brand_name: string | null; error: string | null; aspect_ratio: string };
type Voices = { options: { id: string; label: string }[]; elevenlabs: { configured: boolean; error: string | null } };
type Me = { integrations: { claudeServerKey: boolean; claudeWorkspaceKey: boolean } };

const EXAMPLE = "Create a 30-second cinematic 3D promotional video about international courier services. Show an orange-shirt delivery boy collecting a parcel in India and delivering it to a customer in the USA. Use professional camera movements, beautiful lighting and my company logo.";

function RecycleForm({ brands, onDone }: { brands: Brand[]; onDone: (id: string) => void }) {
  const vids = useApi<{ id: string; filename: string; duration_sec: number | null }[]>("/api/media?kind=video");
  const [f, setF] = useState({ sourceMediaId: "", title: "", brandId: "", aspectRatio: "9:16", clips: "0-30" });
  const { busy, run } = useAction();
  const submit = () =>
    run(async () => {
      const clips = f.clips.split(",").map((c) => c.trim().split("-").map(Number)).map(([start, end]) => ({ start, end }));
      const r = await api<{ id: string }>("/api/recycle", { method: "POST", json: { ...f, brandId: f.brandId || null, clips } });
      onDone(r.id);
    }, "Recycling started. The clip will appear for review.");
  return (
    <div className="space-y-4">
      <Field label="Source video (from your Media Library)">
        <select className="input" value={f.sourceMediaId} onChange={(e) => setF({ ...f, sourceMediaId: e.target.value })}>
          <option value="">Choose a video…</option>
          {vids.data?.map((v) => <option key={v.id} value={v.id}>{v.filename}{v.duration_sec ? ` (${Math.round(v.duration_sec)}s)` : ""}</option>)}
        </select>
      </Field>
      <Field label="Clips to keep (seconds)" hint="Comma-separated ranges, e.g. 12-41, 95-120. They are joined in order.">
        <input className="input" value={f.clips} onChange={(e) => setF({ ...f, clips: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Format">
          <select className="input" value={f.aspectRatio} onChange={(e) => setF({ ...f, aspectRatio: e.target.value })}>
            <option value="9:16">9:16 Reel / Short</option><option value="1:1">1:1 Square</option><option value="16:9">16:9 Landscape</option>
          </select>
        </Field>
      </div>
      <Field label="Brand (optional)">
        <select className="input" value={f.brandId} onChange={(e) => setF({ ...f, brandId: e.target.value })}>
          <option value="">None</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      <button className="btn-primary w-full" disabled={busy || !f.sourceMediaId || !f.title} onClick={submit}>{busy ? <Spinner /> : <Recycle className="h-4 w-4" />} Create clip</button>
    </div>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const brands = useApi<Brand[]>("/api/brands");
  const videos = useApi<Video[]>("/api/videos", 5000);
  const voices = useApi<Voices>("/api/voices");
  const me = useApi<Me>("/api/me");
  const [recycle, setRecycle] = useState(false);
  const [f, setF] = useState({ instruction: "", brandId: "", style: "auto", aspectRatio: "9:16", durationSec: 30, voice: "", music: "" });
  const [err, setErr] = useState<string | null>(null);
  const { busy, run } = useAction();
  useEffect(() => {
    if (brands.data?.length && !f.brandId) {
      const b = brands.data[0];
      setF((x) => ({ ...x, brandId: b.id, style: b.video_style, aspectRatio: b.aspect_ratio, durationSec: Math.min(b.duration_sec, 120) }));
    }
  }, [brands.data, f.brandId]);
  useEffect(() => {
    if (voices.data && !f.voice) setF((x) => ({ ...x, voice: voices.data!.elevenlabs.configured ? "elevenlabs" : "warm-male" }));
  }, [voices.data, f.voice]);
  const aiReady = me.data && (me.data.integrations.claudeServerKey || me.data.integrations.claudeWorkspaceKey);
  const submit = () =>
    run(async () => {
      setErr(null);
      try {
        const r = await api<{ id: string }>("/api/videos", { method: "POST", json: { ...f, brandId: f.brandId || null } });
        router.push(`/create/${r.id}`);
      } catch (e) {
        setErr((e as Error).message);
        throw e;
      }
    });
  return (
    <Page title="AI Video Creator" subtitle="Describe the video. Claude writes the script and storyboard, the engine renders it, and you review everything before anything is published." actions={<button className="btn-outline" onClick={() => setRecycle(true)}><Recycle className="h-4 w-4" /> Recycle existing video</button>}>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          {me.data && !aiReady ? <div className="mb-4"><Notice tone="warn">Add a Claude API key in <Link className="font-semibold underline" href="/settings">Settings</Link> to generate scripts. Without it the creator can't write storyboards.</Notice></div> : null}
          <Field label="Your instruction">
            <textarea className="input min-h-[150px] text-[15px] leading-relaxed" placeholder={EXAMPLE} value={f.instruction} onChange={(e) => setF({ ...f, instruction: e.target.value })} />
          </Field>
          <button className="mt-1 text-xs font-semibold text-brand-600" onClick={() => setF({ ...f, instruction: EXAMPLE })}>Use the example</button>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Brand">
              <select className="input" value={f.brandId} onChange={(e) => setF({ ...f, brandId: e.target.value })}>
                <option value="">No brand</option>{brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Style">
              <select className="input" value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })}>
                <option value="auto">Let AI choose</option><option value="cinematic3d">Cinematic 3D animation</option><option value="promo">Realistic promotional / motion graphics</option>
              </select>
            </Field>
            <Field label="Format">
              <select className="input" value={f.aspectRatio} onChange={(e) => setF({ ...f, aspectRatio: e.target.value })}>
                <option value="9:16">9:16 — Instagram Reel / YouTube Short</option><option value="16:9">16:9 — YouTube landscape</option><option value="1:1">1:1 — Square</option>
              </select>
            </Field>
            <Field label="Duration (seconds)"><input type="number" min={5} max={120} className="input" value={f.durationSec} onChange={(e) => setF({ ...f, durationSec: Number(e.target.value) })} /></Field>
            <Field label="Voiceover" hint={voices.data?.elevenlabs.error ? `ElevenLabs: ${voices.data.elevenlabs.error}` : undefined}>
              <select className="input" value={f.voice} onChange={(e) => setF({ ...f, voice: e.target.value })}>
                {voices.data?.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Music">
              <select className="input" value={f.music} onChange={(e) => setF({ ...f, music: e.target.value })}>
                <option value="">Brand music, or a mood the AI picks</option>
                {["upbeat", "inspiring", "calm", "dramatic", "corporate"].map((m) => <option key={m} value={`mood:${m}`}>Built-in {m} bed (royalty-free)</option>)}
                <option value="none">No music</option>
              </select>
            </Field>
          </div>
          {err ? <div className="mt-4"><ErrorBox error={err} /></div> : null}
          <button className="btn-primary mt-5 w-full !py-3" disabled={busy || f.instruction.trim().length < 10 || !aiReady} onClick={submit}>
            {busy ? <Spinner /> : <Wand2 className="h-4 w-4" />} Generate video
          </button>
          <p className="mt-3 text-center text-xs text-ink-faint">Nothing is published without your approval.</p>
        </Card>
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Sparkles className="h-5 w-5 text-lilac-500" /> How it works</div>
          <ol className="space-y-3 text-sm text-ink-soft">
            {["Claude reads your instruction and the selected brand's guidelines.", "It writes the script, scenes and voiceover.", "The engine builds the scenes — 3D (Three.js) or motion graphics — adds voice, music, subtitles, logo, intro and outro.", "Claude then watches the finished preview and writes the YouTube title, description, caption and hashtags, and designs the cover.", "You watch it, edit anything, then approve and choose where and when to publish.", "On approval a full-quality 1080p version is rendered and published only to the accounts you chose."].map((s, i) => (
              <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">{i + 1}</span>{s}</li>
            ))}
          </ol>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-bold">Your videos</h2>
      {videos.loading ? <Loading /> : null}
      {videos.data && !videos.data.length ? <Empty icon={Clapperboard} title="No videos yet" text="Describe your first video above." /> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {videos.data?.map((v) => (
          <Link key={v.id} href={`/create/${v.id}`} className="card group !p-0 overflow-hidden transition hover:shadow-lift">
            <div className="relative aspect-video bg-gradient-to-br from-brand-100 to-lilac-100">
              {v.thumbnail_media_id ? <img src={mediaUrl(v.thumbnail_media_id)} alt="" className="h-full w-full object-cover" /> : null}
              {["scripting", "rendering"].includes(v.status) ? (
                <div className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-white/70"><div className="h-full bg-gradient-to-r from-brand-500 to-lilac-500 transition-all" style={{ width: `${Math.max(4, v.render_progress * 100)}%` }} /></div>
              ) : null}
            </div>
            <div className="p-3">
              <div className="line-clamp-1 text-sm font-semibold">{v.title}</div>
              <div className="mt-1 flex items-center justify-between gap-2"><StatusBadge status={v.status} /><span className="text-[11px] text-ink-faint">{v.aspect_ratio}</span></div>
              <div className="mt-1 text-[11px] text-ink-faint">{fmtDate(v.created_at)}</div>
            </div>
          </Link>
        ))}
      </div>
      <Modal open={recycle} onClose={() => setRecycle(false)} title="Recycle an existing video">
        <RecycleForm brands={brands.data ?? []} onDone={(id) => router.push(`/create/${id}`)} />
      </Modal>
    </Page>
  );
}
