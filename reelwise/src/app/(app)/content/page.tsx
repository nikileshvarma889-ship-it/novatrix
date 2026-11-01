"use client";
import { useState } from "react";
import { Copy, PenLine, Sparkles } from "lucide-react";
import { api, Card, ErrorBox, Field, Page, Spinner, fmtDate, useAction, useApi, useToast } from "@/components/ui";

const KINDS = [
  ["instagram_caption", "Instagram captions"], ["youtube_title", "YouTube titles"], ["video_description", "Video descriptions"], ["hashtags", "Hashtags"], ["keywords", "Keywords"],
  ["video_script", "Video scripts"], ["hooks", "Hooks"], ["calls_to_action", "Calls to action"], ["thumbnail_text", "Thumbnail text"], ["community_post_ideas", "Community post ideas"],
];
const TONES = ["professional", "funny", "educational", "promotional", "storytelling", "emotional"];
type Gen = { id: string; kind: string; tone: string; language: string; input: string; output: { variants: { label: string; text: string }[]; notes: string }; created_at: string };

export default function ContentPage() {
  const brands = useApi<{ id: string; name: string; language: string }[]>("/api/brands");
  const history = useApi<Gen[]>("/api/content");
  const toast = useToast();
  const [f, setF] = useState({ kind: "instagram_caption", tone: "professional", language: "English", custom: "", brandId: "", topic: "", platform: "any" });
  const [result, setResult] = useState<Gen | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { busy, run } = useAction();
  const generate = () =>
    run(async () => {
      setErr(null);
      try {
        const r = await api<Gen>("/api/content", { method: "POST", json: { ...f, language: f.language === "Custom" ? f.custom : f.language, brandId: f.brandId || null } });
        setResult(r);
        history.reload();
      } catch (e) {
        setErr((e as Error).message);
        throw e;
      }
    });
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast("ok", "Copied."));
  return (
    <Page title="Content Generator" subtitle="Captions, titles, scripts, hooks and more — in your brand's voice, tone and language.">
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-4 lg:col-span-2">
          <Field label="What to write">
            <div className="grid grid-cols-2 gap-1.5">
              {KINDS.map(([k, l]) => <button key={k} onClick={() => setF({ ...f, kind: k })} className={`rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${f.kind === k ? "bg-brand-500 text-white shadow-lift" : "bg-white/80 text-ink-soft hover:bg-white"}`}>{l}</button>)}
            </div>
          </Field>
          <Field label="Tone">
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => <button key={t} onClick={() => setF({ ...f, tone: t })} className={`chip capitalize ${f.tone === t ? "bg-lilac-500 text-white" : "bg-white text-ink-soft"}`}>{t}</button>)}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Language">
              <select className="input" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>
                {["English", "Telugu", "Hindi", "Custom"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Brand">
              <select className="input" value={f.brandId} onChange={(e) => setF({ ...f, brandId: e.target.value })}>
                <option value="">No brand</option>{brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          </div>
          {f.language === "Custom" ? <Field label="Custom language"><input className="input" placeholder="e.g. Tamil, Spanish" value={f.custom} onChange={(e) => setF({ ...f, custom: e.target.value })} /></Field> : null}
          <Field label="Platform">
            <select className="input" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
              <option value="any">Any</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="youtube">YouTube</option>
            </select>
          </Field>
          <Field label="Topic and details"><textarea className="input min-h-[110px]" placeholder="What's the post about? Include facts, offers and links you want used." value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} /></Field>
          {err ? <ErrorBox error={err} /> : null}
          <button className="btn-primary w-full" disabled={busy || f.topic.trim().length < 3 || (f.language === "Custom" && !f.custom)} onClick={generate}>{busy ? <Spinner /> : <Sparkles className="h-4 w-4" />} Generate</button>
        </Card>
        <div className="space-y-4 lg:col-span-3">
          {result ? (
            <Card>
              <div className="mb-3 font-display text-lg font-bold">Results</div>
              <div className="space-y-3">
                {result.output.variants.map((v, i) => (
                  <div key={i} className="rounded-2xl bg-white/80 p-4">
                    <div className="mb-1 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{v.label}</span><button className="btn-ghost !p-1.5" onClick={() => copy(v.text)} aria-label="Copy"><Copy className="h-4 w-4" /></button></div>
                    <p className="whitespace-pre-wrap text-sm">{v.text}</p>
                  </div>
                ))}
              </div>
              {result.output.notes ? <p className="muted mt-3">{result.output.notes}</p> : null}
            </Card>
          ) : (
            <Card className="flex items-center gap-3 text-sm text-ink-soft"><PenLine className="h-5 w-5 text-brand-500" /> Results appear here. Everything you generate is saved below.</Card>
          )}
          <Card>
            <div className="mb-3 font-display font-bold">History</div>
            {history.data?.length ? (
              <ul className="space-y-2">
                {history.data.map((g) => (
                  <li key={g.id}><button className="w-full rounded-xl bg-white/70 px-3 py-2 text-left text-sm hover:bg-white" onClick={() => setResult(g)}><span className="font-semibold capitalize">{g.kind.replace(/_/g, " ")}</span> · {g.tone} · {g.language}<div className="line-clamp-1 text-xs text-ink-faint">{g.input} — {fmtDate(g.created_at)}</div></button></li>
                ))}
              </ul>
            ) : <p className="muted">Nothing yet.</p>}
          </Card>
        </div>
      </div>
    </Page>
  );
}
