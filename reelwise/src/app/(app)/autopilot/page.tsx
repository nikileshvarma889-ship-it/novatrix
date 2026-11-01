"use client";
import { useState } from "react";
import { Bot, Pause, Play, Plus, Trash2 } from "lucide-react";
import { api, Card, Empty, ErrorBox, Field, Loading, Modal, Notice, Page, Spinner, StatusBadge, fmtDate, useAction, useApi } from "@/components/ui";

type Rule = { id: string; name: string; brand_id: string; brand_name: string; instruction: string; platforms: string[]; per_week: number; publish_times: string[]; style: string; aspect_ratio: string; status: string; next_run_at: string | null };
type Run = { id: string; rule_id: string; status: string; message: string; created_at: string };
const blank = { name: "", brandId: "", instruction: "", platforms: ["instagram"], perWeek: 3, publishTimes: "10:00", style: "auto", aspectRatio: "9:16" };

export default function AutopilotPage() {
  const { data, error, loading, reload } = useApi<{ rules: Rule[]; runs: Run[] }>("/api/autopilot", 15000);
  const brands = useApi<{ id: string; name: string }[]>("/api/brands");
  const [form, setForm] = useState<(typeof blank & { id?: string }) | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { busy, run } = useAction();
  const save = () =>
    run(async () => {
      setErr(null);
      const json = { ...form, publishTimes: form!.publishTimes.split(",").map((s) => s.trim()).filter(Boolean), id: undefined };
      try {
        await api(form!.id ? `/api/autopilot/${form!.id}` : "/api/autopilot", { method: form!.id ? "PATCH" : "POST", json });
        setForm(null);
        reload();
      } catch (e) {
        setErr((e as Error).message);
        throw e;
      }
    }, "Auto Pilot saved.");
  return (
    <Page
      title="Auto Pilot"
      subtitle="Reelwise drafts videos on a schedule and notifies you. Nothing is published until you approve each video."
      actions={<button className="btn-primary" onClick={() => setForm({ ...blank, brandId: brands.data?.[0]?.id ?? "" })}><Plus className="h-4 w-4" /> New automation</button>}
    >
      <Notice>Example: “Create three Instagram Reels every week about my business” → set Instagram, 3 per week. Each video lands in the creator as “Waiting for approval” with a proposed time.</Notice>
      <div className="mt-6">
        {loading ? <Loading /> : null}
        {error ? <ErrorBox error={error} /> : null}
        {data && !data.rules.length ? <Empty icon={Bot} title="No automations yet" text="Describe what you want made and how often." /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {data?.rules.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center gap-2"><div className="font-display text-lg font-bold">{r.name}</div><span className="ml-auto"><StatusBadge status={r.status} /></span></div>
              <p className="muted mt-1">{r.brand_name} · {r.per_week}× per week · {r.platforms.join(", ")} · {r.publish_times.join(", ")} UTC</p>
              <p className="mt-3 line-clamp-3 text-sm">{r.instruction}</p>
              <p className="mt-2 text-xs text-ink-faint">Next draft: {r.status === "active" ? fmtDate(r.next_run_at) : "paused"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-outline !py-2 text-xs" disabled={busy} onClick={() => run(async () => { await api(`/api/autopilot/${r.id}`, { method: "PATCH", json: { status: r.status === "active" ? "paused" : "active" } }); reload(); }, r.status === "active" ? "Paused." : "Resumed.")}>
                  {r.status === "active" ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
                </button>
                <button className="btn-ghost !py-2 text-xs" onClick={() => setForm({ id: r.id, name: r.name, brandId: r.brand_id, instruction: r.instruction, platforms: r.platforms, perWeek: r.per_week, publishTimes: r.publish_times.join(", "), style: r.style, aspectRatio: r.aspect_ratio })}>Edit</button>
                <button className="btn-ghost !py-2 text-xs" onClick={() => confirm("Delete this automation?") && run(async () => { await api(`/api/autopilot/${r.id}`, { method: "DELETE" }); reload(); }, "Deleted.")}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <h2 className="mb-3 mt-8 font-display text-lg font-bold">History</h2>
      <Card className="!p-0">
        {data?.runs.length ? (
          <ul className="divide-y divide-brand-50">
            {data.runs.map((x) => (
              <li key={x.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <StatusBadge status={x.status === "error" ? "failed" : "ready"} />
                <div className="flex-1"><div>{x.message}</div><div className="text-xs text-ink-faint">{data.rules.find((r) => r.id === x.rule_id)?.name} · {fmtDate(x.created_at)}</div></div>
              </li>
            ))}
          </ul>
        ) : <p className="muted p-5">No runs yet.</p>}
      </Card>
      <Modal open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? "Edit automation" : "New automation"}>
        {form ? (
          <div className="space-y-4">
            <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Brand">
              <select className="input" value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>{brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            </Field>
            <Field label="Instructions"><textarea className="input min-h-[100px]" placeholder="Short educational videos about our services…" value={form.instruction} onChange={(e) => setForm({ ...form, instruction: e.target.value })} /></Field>
            <Field label="Platforms">
              <div className="flex gap-2">
                {["instagram", "facebook", "youtube"].map((p) => (
                  <label key={p} className="chip cursor-pointer bg-white capitalize text-ink-soft">
                    <input type="checkbox" checked={form.platforms.includes(p)} onChange={(e) => setForm({ ...form, platforms: e.target.checked ? [...form.platforms, p] : form.platforms.filter((x) => x !== p) })} /> {p}
                  </label>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Videos per week"><input type="number" min={1} max={21} className="input" value={form.perWeek} onChange={(e) => setForm({ ...form, perWeek: Number(e.target.value) })} /></Field>
              <Field label="Publish times (UTC)" hint="e.g. 10:00, 18:30"><input className="input" value={form.publishTimes} onChange={(e) => setForm({ ...form, publishTimes: e.target.value })} /></Field>
              <Field label="Style"><select className="input" value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}><option value="auto">Auto</option><option value="cinematic3d">Cinematic 3D</option><option value="promo">Promotional</option></select></Field>
              <Field label="Format"><select className="input" value={form.aspectRatio} onChange={(e) => setForm({ ...form, aspectRatio: e.target.value })}><option value="9:16">9:16</option><option value="16:9">16:9</option><option value="1:1">1:1</option></select></Field>
            </div>
            {err ? <ErrorBox error={err} /> : null}
            <button className="btn-primary w-full" disabled={busy || !form.name || !form.brandId || !form.platforms.length} onClick={save}>{busy ? <Spinner /> : null} Save</button>
          </div>
        ) : null}
      </Modal>
    </Page>
  );
}
