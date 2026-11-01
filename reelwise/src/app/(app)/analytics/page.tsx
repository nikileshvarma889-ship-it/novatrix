"use client";
import { useMemo, useState } from "react";
import { BarChart3, RefreshCw, Sparkles } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, Card, Empty, ErrorBox, Loading, Page, Spinner, fmtDate, useAction, useApi } from "@/components/ui";

type Data = {
  accounts: { id: string; platform: string; name: string; status: string; last_error: string | null; meta: { statistics?: Record<string, string> } }[];
  snapshots: { social_account_id: string; day: string; metrics: Record<string, unknown> }[];
  posts: { id: string; platform: string; title: string; published_at: string; external_url: string | null; metrics: Record<string, number> | null }[];
};
const num = (x: unknown) => (typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" && !isNaN(Number(x)) ? Number(x) : null);
const views = (m: Record<string, unknown> | null) => num(m?.viewCount) ?? num(m?.views) ?? num(m?.total_video_views) ?? null;

export default function AnalyticsPage() {
  const { data, error, loading, reload } = useApi<Data>("/api/analytics");
  const [period, setPeriod] = useState<7 | 28>(28);
  const [recs, setRecs] = useState<{ title: string; detail: string }[] | null>(null);
  const { busy, run } = useAction();
  // YouTube returns a daily series; Meta returns period totals (shown as cards).
  const series = useMemo(() => {
    const since = Date.now() - period * 86400_000;
    const byDay: Record<string, Record<string, number>> = {};
    for (const s of data?.snapshots ?? []) {
      const acct = data?.accounts.find((a) => a.id === s.social_account_id);
      if (acct?.platform !== "youtube" || new Date(s.day).getTime() < since) continue;
      const d = s.day.slice(0, 10);
      byDay[d] ??= { views: 0, likes: 0, comments: 0, shares: 0, watchMinutes: 0, subscribers: 0 };
      byDay[d].views += num(s.metrics.views) ?? 0;
      byDay[d].likes += num(s.metrics.likes) ?? 0;
      byDay[d].comments += num(s.metrics.comments) ?? 0;
      byDay[d].shares += num(s.metrics.shares) ?? 0;
      byDay[d].watchMinutes += num(s.metrics.estimatedMinutesWatched) ?? 0;
      byDay[d].subscribers += (num(s.metrics.subscribersGained) ?? 0) - (num(s.metrics.subscribersLost) ?? 0);
    }
    type Row = { day: string; views: number; likes: number; comments: number; shares: number; watchMinutes: number; subscribers: number };
    return Object.entries(byDay).sort().map(([day, m]) => ({ day: day.slice(5), ...m }) as Row);
  }, [data, period]);
  const totals = series.reduce((a, d) => ({ views: a.views + d.views, likes: a.likes + d.likes, comments: a.comments + d.comments, shares: a.shares + d.shares, watch: a.watch + d.watchMinutes, subs: a.subs + d.subscribers }), { views: 0, likes: 0, comments: 0, shares: 0, watch: 0, subs: 0 });
  const meta = data?.accounts.filter((a) => a.platform !== "youtube").map((a) => ({ a, snap: [...(data?.snapshots ?? [])].reverse().find((s) => s.social_account_id === a.id) })) ?? [];
  const top = [...(data?.posts ?? [])].filter((p) => p.metrics).sort((a, b) => (views(b.metrics) ?? 0) - (views(a.metrics) ?? 0)).slice(0, 8);
  const hasData = Boolean(data?.snapshots.length || data?.posts.some((p) => p.metrics));
  return (
    <Page
      title="Analytics"
      subtitle="Figures come only from the official Instagram, Facebook and YouTube APIs. Nothing is estimated or filled in."
      actions={
        <>
          <div className="flex rounded-xl bg-white/70 p-1">{([7, 28] as const).map((p) => <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${period === p ? "bg-white shadow-soft" : "text-ink-soft"}`}>{p === 7 ? "Weekly" : "Monthly"}</button>)}</div>
          <button className="btn-outline" disabled={busy} onClick={() => run(async () => { await api("/api/analytics/sync", { method: "POST" }); setTimeout(reload, 8000); }, "Syncing from the platforms…")}><RefreshCw className="h-4 w-4" /> Sync now</button>
        </>
      }
    >
      {loading ? <Loading /> : null}
      {error ? <ErrorBox error={error} /> : null}
      {data && !data.accounts.length ? <Empty icon={BarChart3} title="No connected accounts" text="Connect Instagram, Facebook or YouTube to see real analytics here." /> : null}
      {data?.accounts.length && !hasData ? <Empty icon={BarChart3} title="No analytics returned yet" text="Press “Sync now”. Some metrics need a few days of activity, and Instagram/Facebook insights require the insights permissions." /> : null}
      {data?.accounts.filter((a) => a.last_error).map((a) => <div key={a.id} className="mb-3"><ErrorBox error={`${a.name}: ${a.last_error}`} /></div>)}

      {series.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[["Views", totals.views], ["Likes", totals.likes], ["Comments", totals.comments], ["Shares", totals.shares], ["Watch time (min)", Math.round(totals.watch)], ["Net subscribers", totals.subs]].map(([l, v]) => (
              <Card key={l as string} className="!p-4"><div className="text-[11px] font-semibold uppercase text-ink-faint">YouTube · {l}</div><div className="mt-1 font-display text-2xl font-extrabold">{(v as number).toLocaleString()}</div></Card>
            ))}
          </div>
          <Card className="mt-4">
            <div className="mb-3 font-display font-bold">YouTube performance — last {period} days</div>
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={series}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b6cff" stopOpacity={0.35} /><stop offset="100%" stopColor="#5b6cff" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="#e4e8ff" vertical={false} /><XAxis dataKey="day" fontSize={11} stroke="#8b92ad" /><YAxis fontSize={11} stroke="#8b92ad" /><Tooltip /><Legend />
                  <Area type="monotone" dataKey="views" stroke="#5b6cff" fill="url(#g)" strokeWidth={2} />
                  <Area type="monotone" dataKey="likes" stroke="#9b7bff" fillOpacity={0} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      ) : null}

      {meta.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {meta.map(({ a, snap }) => (
            <Card key={a.id}>
              <div className="font-display font-bold">{a.name} <span className="text-xs font-normal capitalize text-ink-faint">{a.platform} · last 28 days</span></div>
              {snap ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {Object.entries({ followers: (snap.metrics as { followers?: number }).followers, ...((snap.metrics as { totals?: Record<string, number> }).totals ?? {}) })
                    .filter(([, v]) => v !== null && v !== undefined)
                    .map(([k, v]) => <div key={k} className="rounded-xl bg-white/80 p-3"><div className="text-[11px] uppercase text-ink-faint">{k}</div><div className="font-display text-lg font-bold">{Number(v).toLocaleString()}</div></div>)}
                </div>
              ) : <p className="muted mt-2">No data synced yet.</p>}
            </Card>
          ))}
        </div>
      ) : null}

      {top.length ? (
        <Card className="mt-4">
          <div className="mb-3 font-display font-bold">Top-performing videos</div>
          <div className="h-64"><ResponsiveContainer><BarChart data={top.map((p) => ({ name: p.title.slice(0, 18), views: views(p.metrics) ?? 0 }))}><CartesianGrid stroke="#e4e8ff" vertical={false} /><XAxis dataKey="name" fontSize={10} stroke="#8b92ad" /><YAxis fontSize={11} stroke="#8b92ad" /><Tooltip /><Bar dataKey="views" fill="#7d8bff" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <ul className="mt-3 space-y-1 text-sm">{top.map((p) => <li key={p.id} className="flex justify-between gap-2"><a className="truncate hover:underline" href={p.external_url ?? "#"} target="_blank" rel="noreferrer">{p.title}</a><span className="shrink-0 text-ink-soft">{p.platform} · {fmtDate(p.published_at)}</span></li>)}</ul>
        </Card>
      ) : null}

      {hasData ? (
        <Card className="mt-4">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-lilac-500" /><div className="font-display font-bold">AI recommendations</div>
            <button className="btn-outline ml-auto !py-1.5 text-xs" disabled={busy} onClick={() => run(async () => setRecs((await api<{ recommendations: { title: string; detail: string }[] }>("/api/analytics/recommendations", { method: "POST" })).recommendations))}>{busy ? <Spinner /> : null} Analyse my data</button></div>
          {recs ? <ul className="mt-3 space-y-2">{recs.map((r, i) => <li key={i} className="rounded-xl bg-white/80 p-3"><div className="font-semibold">{r.title}</div><div className="text-sm text-ink-soft">{r.detail}</div></li>)}</ul> : <p className="muted mt-2">Claude reviews your real metrics and suggests what to make next.</p>}
        </Card>
      ) : null}
    </Page>
  );
}
