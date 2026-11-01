"use client";
import { useState } from "react";
import { Palette, Plus, Trash2, Upload } from "lucide-react";
import { api, Card, Empty, ErrorBox, Field, Loading, Modal, Page, Spinner, mediaUrl, useAction, useApi } from "@/components/ui";
import { upload } from "@/components/upload";

type Brand = {
  id?: string; name: string; description: string; audience: string; language: string; video_style: string; colors: string[]; fonts: { heading: string; body: string };
  characters: string; intro_text: string; outro_text: string; contact: string; website: string; cta: string; duration_sec: number; aspect_ratio: string;
  music_pref: string; voice_pref: string; restrictions: string; logo_media_id: string | null; music_media_id: string | null;
};
const blank: Brand = {
  name: "", description: "", audience: "", language: "English", video_style: "auto", colors: ["#5b6cff", "#a78bfa", "#0f172a"], fonts: { heading: "Inter", body: "Inter" },
  characters: "", intro_text: "", outro_text: "", contact: "", website: "", cta: "", duration_sec: 30, aspect_ratio: "9:16", music_pref: "", voice_pref: "", restrictions: "",
  logo_media_id: null, music_media_id: null,
};
type Media = { id: string; filename: string; kind: string; mime: string };

function BrandEditor({ initial, onDone }: { initial: Brand; onDone: () => void }) {
  const [b, setB] = useState<Brand>(initial);
  const [err, setErr] = useState<string | null>(null);
  const { busy, run } = useAction();
  const assets = useApi<Media[]>(b.id ? `/api/media?brandId=${b.id}` : null);
  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setB({ ...b, [k]: v });
  const txt = (k: keyof Brand, area = false, ph = "") =>
    area ? <textarea className="input min-h-[84px]" placeholder={ph} value={b[k] as string} onChange={(e) => set(k, e.target.value as never)} /> : <input className="input" placeholder={ph} value={b[k] as string} onChange={(e) => set(k, e.target.value as never)} />;
  const save = () =>
    run(async () => {
      setErr(null);
      try {
        await api(b.id ? `/api/brands/${b.id}` : "/api/brands", { method: b.id ? "PUT" : "POST", json: { ...b, id: undefined, created_at: undefined, updated_at: undefined, workspace_id: undefined } });
        onDone();
      } catch (e) {
        setErr((e as Error).message);
        throw e;
      }
    }, "Brand saved.");
  const uploadTo = async (file: File, purpose?: string) => {
    if (!b.id) return setErr("Save the brand first, then add files.");
    const r = await run(() => upload(file, { brandId: b.id, purpose }), "Uploaded.");
    if (r && purpose === "logo") set("logo_media_id", r.id);
    if (r && r.kind === "audio" && purpose === "music") set("music_media_id", r.id);
    assets.reload();
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Brand name">{txt("name")}</Field>
        <Field label="Website">{txt("website", false, "https://")}</Field>
        <div className="md:col-span-2"><Field label="Brand description">{txt("description", true, "What you do, what makes you different")}</Field></div>
        <Field label="Target audience">{txt("audience", true, "e.g. small businesses in India shipping to the US")}</Field>
        <Field label="Content restrictions" hint="The AI must always follow these.">{txt("restrictions", true, "e.g. never mention competitors, no price promises")}</Field>
        <Field label="Preferred language">{txt("language")}</Field>
        <Field label="Call to action">{txt("cta", false, "e.g. Book a pickup today")}</Field>
        <Field label="Preferred video style">
          <select className="input" value={b.video_style} onChange={(e) => set("video_style", e.target.value)}>
            <option value="auto">Let AI choose</option><option value="cinematic3d">Cinematic 3D animation</option><option value="promo">Promotional motion graphics</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Video duration (s)"><input type="number" min={5} max={180} className="input" value={b.duration_sec} onChange={(e) => set("duration_sec", Number(e.target.value))} /></Field>
          <Field label="Aspect ratio">
            <select className="input" value={b.aspect_ratio} onChange={(e) => set("aspect_ratio", e.target.value)}>
              <option value="9:16">9:16 Reels / Shorts</option><option value="16:9">16:9 YouTube</option><option value="1:1">1:1 Square</option>
            </select>
          </Field>
        </div>
        <Field label="Brand colours">
          <div className="flex gap-2">
            {b.colors.map((c, i) => (
              <label key={i} className="flex items-center gap-2 rounded-xl border border-brand-100 bg-white px-2 py-1.5">
                <input type="color" value={c} onChange={(e) => set("colors", b.colors.map((x, j) => (j === i ? e.target.value : x)))} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent" />
                <span className="font-mono text-xs">{c}</span>
              </label>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Heading font"><input className="input" value={b.fonts.heading} onChange={(e) => set("fonts", { ...b.fonts, heading: e.target.value })} /></Field>
          <Field label="Body font"><input className="input" value={b.fonts.body} onChange={(e) => set("fonts", { ...b.fonts, body: e.target.value })} /></Field>
        </div>
        <Field label="Characters / mascots">{txt("characters", true, "e.g. courier in an orange shirt and cap")}</Field>
        <Field label="Contact information">{txt("contact", true, "phone, email, address")}</Field>
        <Field label="Intro line" hint="Shown on the opening brand card (leave empty to skip the intro).">{txt("intro_text")}</Field>
        <Field label="Outro line">{txt("outro_text")}</Field>
        <Field label="Background music preference">{txt("music_pref", false, "e.g. upbeat, inspiring")}</Field>
        <Field label="Voiceover preference">{txt("voice_pref", false, "e.g. warm male voice, friendly")}</Field>
      </div>

      <div className="rounded-2xl bg-brand-50/60 p-4">
        <div className="mb-3 text-sm font-semibold">Brand assets</div>
        {!b.id ? <p className="muted">Save the brand first, then upload a logo, product images, reference images, videos, fonts and music you have permission to use.</p> : (
          <>
            <div className="flex flex-wrap gap-2">
              {[["Logo", "logo", "image/png,image/jpeg,image/webp"], ["Images / product photos", "", "image/*"], ["Videos", "", "video/*"], ["Music (licensed)", "music", "audio/*"], ["Font file", "", ".ttf,.otf,.woff2"]].map(([label, purpose, accept]) => (
                <label key={label} className="btn-outline cursor-pointer !py-2 text-xs">
                  <Upload className="h-3.5 w-3.5" /> {label}
                  <input type="file" className="hidden" accept={accept} onChange={(e) => e.target.files?.[0] && uploadTo(e.target.files[0], purpose || undefined)} />
                </label>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {assets.data?.map((m) => (
                <div key={m.id} className="relative overflow-hidden rounded-xl bg-white">
                  {m.mime.startsWith("image") ? <img src={mediaUrl(m.id)} alt={m.filename} className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center p-2 text-center text-[11px] text-ink-soft">{m.filename}</div>}
                  {b.logo_media_id === m.id ? <span className="chip absolute left-1 top-1 bg-brand-500 text-white">Logo</span> : null}
                  {b.music_media_id === m.id ? <span className="chip absolute left-1 top-1 bg-lilac-500 text-white">Music</span> : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {err ? <ErrorBox error={err} /> : null}
      <div className="flex justify-end gap-2">
        <button className="btn-primary" disabled={busy || !b.name} onClick={save}>{busy ? <Spinner /> : null} Save brand</button>
      </div>
    </div>
  );
}

export default function BrandsPage() {
  const { data, error, loading, reload } = useApi<(Brand & { id: string })[]>("/api/brands");
  const [editing, setEditing] = useState<Brand | null>(null);
  const { run } = useAction();
  return (
    <Page title="Brand Studio" subtitle="Each brand keeps its own guidelines, assets and restrictions. Videos only ever use the brand you select." actions={<button className="btn-primary" onClick={() => setEditing(blank)}><Plus className="h-4 w-4" /> New brand</button>}>
      {loading ? <Loading /> : null}
      {error ? <ErrorBox error={error} /> : null}
      {data && !data.length ? <Empty icon={Palette} title="No brands yet" text="Create a brand profile with your colours, logo, audience and rules. Every video follows it." action={<button className="btn-primary" onClick={() => setEditing(blank)}>Create a brand</button>} /> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((b) => (
          <Card key={b.id} className="cursor-pointer transition hover:shadow-lift" onClick={() => setEditing(b)}>
            <div className="flex items-center gap-3">
              {b.logo_media_id ? <img src={mediaUrl(b.logo_media_id)} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1" /> : <div className="h-12 w-12 rounded-xl" style={{ background: `linear-gradient(135deg, ${b.colors[0]}, ${b.colors[1]})` }} />}
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-bold">{b.name}</div>
                <div className="text-xs text-ink-soft">{b.language} · {b.aspect_ratio} · {b.duration_sec}s</div>
              </div>
              <button className="btn-ghost !p-2" aria-label="Delete brand" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${b.name}?`)) run(async () => { await api(`/api/brands/${b.id}`, { method: "DELETE" }); reload(); }, "Brand deleted."); }}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-1.5">{b.colors.map((c) => <span key={c} className="h-5 w-5 rounded-full border border-white shadow" style={{ background: c }} />)}</div>
            <p className="muted mt-3 line-clamp-2">{b.description || "No description yet."}</p>
          </Card>
        ))}
      </div>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.name}` : "New brand"} wide>
        {editing ? <BrandEditor key={editing.id ?? "new"} initial={editing} onDone={() => { setEditing(null); reload(); }} /> : null}
      </Modal>
    </Page>
  );
}
