"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Circle, Clapperboard, Link2, ListChecks, Palette, Settings, Sparkles } from "lucide-react";
import { Card, Loading, Page, StatusBadge, fmtDate, mediaUrl, useApi } from "@/components/ui";

type Video = { id: string; title: string; status: string; render_progress: number; thumbnail_media_id: string | null; created_at: string; brand_name: string | null };
type Pub = { id: string; status: string; title: string; account_name: string; platform: string; scheduled_at: string | null; published_at: string | null };
type Me = { ai: { name: string; ready: boolean }; integrations: { meta: boolean; google: boolean } };

export default function Dashboard() {
  const videos = useApi<Video[]>("/api/videos", 15_000);
  const pubs = useApi<Pub[]>("/api/publications");
  const accounts = useApi<{ id: string }[]>("/api/accounts");
  const brands = useApi<{ id: string }[]>("/api/brands");
  const me = useApi<Me>("/api/me");
  const pending = videos.data?.filter((v) => v.status === "ready") ?? [];
  const scheduled = pubs.data?.filter((p) => p.status === "scheduled") ?? [];
  const published = pubs.data?.filter((p) => p.status === "published") ?? [];
  const ai = me.data?.ai.ready;
  const steps = [
    { done: Boolean(ai), label: "Add your AI key (Gemini or Claude)", href: "/settings", icon: Settings },
    { done: Boolean(brands.data?.length), label: "Create a brand profile", href: "/brands", icon: Palette },
    { done: Boolean(accounts.data?.length), label: "Connect Instagram, Facebook or YouTube", href: "/accounts", icon: Link2 },
    { done: Boolean(videos.data?.length), label: "Create your first video", href: "/create", icon: Clapperboard },
  ];
  const stats = [
    { label: "Waiting for approval", value: pending.length, href: "/create" },
    { label: "Scheduled posts", value: scheduled.length, href: "/queue" },
    { label: "Published", value: published.length, href: "/queue" },
    { label: "Connected accounts", value: accounts.data?.length ?? 0, href: "/accounts" },
  ];
  return (
    <Page title="Dashboard" subtitle="Everything you're creating, approving and publishing — in one place.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={s.href} className="card block transition hover:shadow-lift">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{s.label}</div>
              <div className="mt-2 font-display text-3xl font-extrabold">{videos.loading ? "–" : s.value}</div>
            </Link>
          </motion.div>
        ))}
      </div>

      {steps.some((s) => !s.done) ? (
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center gap-2 font-display text-lg font-bold"><Sparkles className="h-5 w-5 text-lilac-500" /> Get set up</div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {steps.map((s) => (
              <Link key={s.label} href={s.href} className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3 text-sm transition hover:bg-white">
                {s.done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-ink-faint" />}
                <span className={s.done ? "text-ink-faint line-through" : "font-medium"}>{s.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-ink-faint" />
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-lg font-bold">Recent videos</div>
            <Link href="/create" className="text-sm font-semibold text-brand-600">Open creator</Link>
          </div>
          {videos.loading ? <Loading /> : null}
          {videos.data && !videos.data.length ? <p className="muted">No videos yet. Describe one in the AI Video Creator.</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videos.data?.slice(0, 6).map((v) => (
              <Link key={v.id} href={`/create/${v.id}`} className="group overflow-hidden rounded-2xl bg-white/70 transition hover:shadow-lift">
                <div className="aspect-video bg-gradient-to-br from-brand-100 to-lilac-100">
                  {v.thumbnail_media_id ? <img src={mediaUrl(v.thumbnail_media_id)} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="p-3">
                  <div className="line-clamp-1 text-sm font-semibold">{v.title}</div>
                  <div className="mt-1.5"><StatusBadge status={v.status} /></div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-4 flex items-center gap-2 font-display text-lg font-bold"><ListChecks className="h-5 w-5 text-brand-500" /> Upcoming</div>
          {scheduled.length ? (
            <ul className="space-y-3">
              {scheduled.slice(0, 6).map((p) => (
                <li key={p.id} className="rounded-xl bg-white/70 px-3 py-2.5">
                  <div className="line-clamp-1 text-sm font-semibold">{p.title}</div>
                  <div className="text-xs text-ink-soft">{p.account_name} · {fmtDate(p.scheduled_at)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing scheduled. Approved videos appear here.</p>
          )}
        </Card>
      </div>
    </Page>
  );
}
