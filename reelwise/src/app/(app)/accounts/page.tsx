"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Facebook, Instagram, Link2, Unplug, Youtube } from "lucide-react";
import { api, Card, ErrorBox, Loading, Notice, Page, StatusBadge, useAction, useApi, useToast, fmtDate } from "@/components/ui";

type Account = { id: string; platform: string; name: string; avatar_url: string | null; status: string; last_error: string | null; scopes: string[]; created_at: string };
type Settings = { integrations: { meta: boolean; google: boolean }; redirects: { meta: string; google: string } };
const ICON = { facebook: Facebook, instagram: Instagram, youtube: Youtube } as const;

function Inner() {
  const params = useSearchParams();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<Account[]>("/api/accounts");
  const settings = useApi<Settings>("/api/settings");
  const { busy, run } = useAction();
  useEffect(() => {
    if (params.get("connected")) toast("ok", params.get("connected")!);
    if (params.get("error")) toast("err", params.get("error")!);
  }, [params, toast]);
  const s = settings.data;
  const providers = [
    { key: "meta", title: "Instagram & Facebook", text: "Connect Facebook Pages and the Instagram professional accounts linked to them, with Meta's official login.", href: "/api/oauth/meta/start", ready: s?.integrations.meta, icons: [Instagram, Facebook], doc: "docs/SETUP_META.md", redirect: s?.redirects.meta },
    { key: "google", title: "YouTube", text: "Connect YouTube channels with Google's official login to upload videos, set thumbnails and read analytics.", href: "/api/oauth/google/start", ready: s?.integrations.google, icons: [Youtube], doc: "docs/SETUP_GOOGLE.md", redirect: s?.redirects.google },
  ];
  return (
    <Page title="Connected Accounts" subtitle="Accounts connect through the platforms' official OAuth. Reelwise never asks for or stores your passwords.">
      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => (
          <Card key={p.key} className="flex flex-col">
            <div className="flex items-center gap-2">
              {p.icons.map((I, i) => (
                <div key={i} className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-50 to-lilac-100 text-brand-600"><I className="h-5 w-5" /></div>
              ))}
              <div className="ml-1 font-display text-lg font-bold">{p.title}</div>
            </div>
            <p className="muted mt-3 flex-1">{p.text}</p>
            {s && !p.ready ? (
              <div className="mt-4">
                <Notice tone="warn">
                  The server administrator needs to add the {p.key === "meta" ? "META_APP_ID and META_APP_SECRET" : "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"} environment variables first
                  (see <code>{p.doc}</code>). The OAuth redirect URI to register is <code className="break-all">{p.redirect}</code>.
                </Notice>
              </div>
            ) : null}
            <a href={p.ready ? p.href : undefined} aria-disabled={!p.ready} className={`btn-primary mt-4 ${p.ready ? "" : "pointer-events-none opacity-50"}`}>
              <Link2 className="h-4 w-4" /> Connect {p.title}
            </a>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-bold">Your connected accounts</h2>
      {loading ? <Loading /> : null}
      {error ? <ErrorBox error={error} /> : null}
      {data && !data.length ? <p className="muted">No accounts connected yet.</p> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((a) => {
          const Icon = ICON[a.platform as keyof typeof ICON];
          return (
            <Card key={a.id} className="!p-4">
              <div className="flex items-center gap-3">
                {a.avatar_url ? <img src={a.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-50"><Icon className="h-5 w-5 text-brand-600" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{a.name}</div>
                  <div className="flex items-center gap-1.5 text-xs capitalize text-ink-soft"><Icon className="h-3.5 w-3.5" /> {a.platform} · since {fmtDate(a.created_at)}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
              {a.last_error ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{a.last_error}</p> : null}
              <div className="mt-3 flex gap-2">
                {a.status !== "connected" ? <a className="btn-outline !py-2 text-xs" href={a.platform === "youtube" ? "/api/oauth/google/start" : "/api/oauth/meta/start"}>Reconnect</a> : null}
                <button
                  className="btn-danger !py-2 text-xs"
                  disabled={busy}
                  onClick={() => confirm(`Disconnect ${a.name}? Scheduled posts for it will be cancelled.`) && run(async () => { await api(`/api/accounts/${a.id}`, { method: "DELETE" }); reload(); }, "Account disconnected.")}
                >
                  <Unplug className="h-3.5 w-3.5" /> Disconnect
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}

export default function AccountsPage() {
  return <Suspense><Inner /></Suspense>;
}
