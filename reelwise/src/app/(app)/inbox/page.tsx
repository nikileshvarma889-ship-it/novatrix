"use client";
import { useState } from "react";
import { CheckCheck, Inbox, RefreshCw, Send, Sparkles } from "lucide-react";
import { api, Card, Empty, ErrorBox, Loading, Notice, Page, Spinner, StatusBadge, fmtDate, useAction, useApi } from "@/components/ui";

type Item = { id: string; platform: string; account_name: string; social_account_id: string; author: string; text: string; permalink: string | null; context_title: string | null; received_at: string; status: string; suggested_reply: string | null; reply_text: string | null };

function Row({ item, onChange }: { item: Item; onChange: () => void }) {
  const [draft, setDraft] = useState(item.suggested_reply ?? "");
  const [ok, setOk] = useState(false);
  const { busy, run } = useAction();
  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft"><span className="font-semibold text-ink">{item.author || "Someone"}</span> on <span className="capitalize">{item.platform}</span> · {item.account_name} · {fmtDate(item.received_at)}<span className="ml-auto"><StatusBadge status={item.status} /></span></div>
      {item.context_title ? <div className="mt-1 text-xs text-ink-faint">Post: {item.context_title}</div> : null}
      <p className="mt-2 text-sm">{item.text}</p>
      {item.status === "replied" ? <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">You replied: {item.reply_text}</p> : (
        <div className="mt-3 space-y-2">
          <textarea className="input min-h-[70px]" placeholder="Write a reply, or ask AI for a suggestion…" value={draft} onChange={(e) => { setDraft(e.target.value); setOk(false); }} />
          <label className="flex items-center gap-2 text-xs text-ink-soft"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I reviewed this reply and want to post it publicly.</label>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline !py-2 text-xs" disabled={busy} onClick={() => run(async () => { const r = await api<{ reply: string; needsHuman: boolean }>(`/api/inbox/${item.id}/suggest`, { method: "POST" }); setDraft(r.reply); setOk(false); if (r.needsHuman) throw new Error("This looks sensitive. Please review carefully before replying."); })}><Sparkles className="h-3.5 w-3.5" /> Suggest reply</button>
            <button className="btn-primary !py-2 text-xs" disabled={busy || !draft.trim() || !ok} onClick={() => run(async () => { await api(`/api/inbox/${item.id}/reply`, { method: "POST", json: { text: draft, confirm: true } }); onChange(); }, "Reply posted.")}>{busy ? <Spinner /> : <Send className="h-3.5 w-3.5" />} Send reply</button>
            <button className="btn-ghost !py-2 text-xs" disabled={busy} onClick={() => run(async () => { await api(`/api/inbox/${item.id}/resolve`, { method: "POST" }); onChange(); })}><CheckCheck className="h-3.5 w-3.5" /> {item.status === "resolved" ? "Reopen" : "Mark resolved"}</button>
            {item.permalink ? <a className="btn-ghost !py-2 text-xs" href={item.permalink} target="_blank" rel="noreferrer">Open</a> : null}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function InboxPage() {
  const accounts = useApi<{ id: string; name: string; platform: string }[]>("/api/accounts");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("open");
  const { data, error, loading, reload } = useApi<Item[]>(`/api/inbox?status=${status}${account ? `&accountId=${account}` : ""}`);
  const { busy, run } = useAction();
  return (
    <Page title="Smart Inbox" subtitle="Comments from your connected accounts. AI drafts suggestions; nothing is posted until you press Send." actions={<button className="btn-outline" disabled={busy} onClick={() => run(async () => { await api("/api/inbox/sync", { method: "POST" }); setTimeout(reload, 8000); }, "Fetching new comments…")}><RefreshCw className="h-4 w-4" /> Sync</button>}>
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input !w-auto" value={account} onChange={(e) => setAccount(e.target.value)}><option value="">All accounts</option>{accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.platform})</option>)}</select>
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="open">Open</option><option value="replied">Replied</option><option value="resolved">Resolved</option><option value="all">All</option></select>
      </div>
      <Notice>Direct messages need extra Meta permissions (Instagram/Messenger messaging) that require separate App Review; this inbox covers comments, which the connected permissions allow.</Notice>
      <div className="mt-4 space-y-3">
        {loading ? <Loading /> : null}
        {error ? <ErrorBox error={error} /> : null}
        {data && !data.length ? <Empty icon={Inbox} title="Inbox zero" text="New comments appear here after a sync (every 30 minutes automatically)." /> : null}
        {data?.map((i) => <Row key={i.id} item={i} onChange={reload} />)}
      </div>
    </Page>
  );
}
