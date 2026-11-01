"use client";
import { useEffect, useState } from "react";
import { KeyRound, Mic, ScrollText, ShieldCheck, Users } from "lucide-react";
import { api, Card, ErrorBox, Field, Notice, Page, Spinner, StatusBadge, fmtDate, useAction, useApi } from "@/components/ui";

type S = { has_gemini_key: boolean; ai_provider: "claude" | "gemini" | null; geminiServerKey: boolean; ai: { provider: string; name: string; model: string; ready: boolean }; has_claude_key: boolean; has_elevenlabs_key: boolean; elevenlabsServerKey: boolean; voiceDefaults: { voice: string; language: string; model: string }; integrations: { meta: boolean; google: boolean; claudeServerKey: boolean }; redirects: { meta: string; google: string }; appUrl: string };
type Member = { id: string; email: string; name: string; role: string };
type Log = { id: string; action: string; email: string | null; ip: string | null; created_at: string; target_type: string | null };

export default function SettingsPage() {
  const s = useApi<S>("/api/settings");
  const members = useApi<Member[]>("/api/settings/members");
  const logs = useApi<Log[]>("/api/settings/audit");
  const [claude, setClaude] = useState("");
  const [gemini, setGemini] = useState("");
  const [eleven, setEleven] = useState("");
  const [voice, setVoice] = useState({ voice: "", language: "", model: "" });
  const [invite, setInvite] = useState({ email: "", role: "editor" });
  const { busy, run } = useAction();
  useEffect(() => { if (s.data) setVoice(s.data.voiceDefaults); }, [s.data]);
  const put = (json: unknown, ok: string) => run(async () => { await api("/api/settings", { method: "PUT", json }); s.reload(); }, ok);
  const d = s.data;
  return (
    <Page title="Settings" subtitle="Keys are encrypted on the server and never shown again after saving.">
      {s.error ? <ErrorBox error={s.error} /> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><KeyRound className="h-5 w-5 text-brand-500" /> AI</div>
          <p className="muted mb-3">
            Scripts, titles, descriptions, hashtags, covers and reply drafts are written by the AI you choose.
            Now using: <b>{d?.ai.name ?? "…"}</b> <span className="text-ink-faint">({d?.ai.model})</span> {d ? (d.ai.ready ? <StatusBadge status="connected" /> : <StatusBadge status="expired" />) : null}
          </p>
          <Field label="AI provider">
            <select className="input" value={d?.ai_provider ?? "auto"} disabled={busy || !d} onChange={(e) => put({ aiProvider: e.target.value }, "AI provider saved.")}>
              <option value="auto">Automatic (whichever has a key)</option>
              <option value="gemini">Google Gemini (free tier available)</option>
              <option value="claude">Anthropic Claude (paid API credit)</option>
            </select>
          </Field>
          <div className="mt-4 label">Gemini API key {d?.has_gemini_key ? <StatusBadge status="connected" /> : d?.geminiServerKey ? <span className="font-normal normal-case text-ink-faint">· using the server&apos;s key</span> : null}</div>
          <div className="flex gap-2"><input className="input" type="password" placeholder="From aistudio.google.com → Get API key" value={gemini} onChange={(e) => setGemini(e.target.value)} /><button className="btn-primary" disabled={busy || !gemini} onClick={() => { put({ geminiKey: gemini }, "Gemini key verified and saved."); setGemini(""); }}>{busy ? <Spinner /> : null} Save</button></div>
          {d?.has_gemini_key ? <button className="btn-ghost mt-2 text-xs" onClick={() => put({ geminiKey: null }, "Gemini key removed.")}>Remove Gemini key</button> : null}
          <div className="mt-4 label">Claude API key {d?.has_claude_key ? <StatusBadge status="connected" /> : d?.integrations.claudeServerKey ? <span className="font-normal normal-case text-ink-faint">· using the server&apos;s key</span> : null}</div>
          <div className="flex gap-2"><input className="input" type="password" placeholder="sk-ant-…" value={claude} onChange={(e) => setClaude(e.target.value)} /><button className="btn-primary" disabled={busy || !claude} onClick={() => { put({ claudeKey: claude }, "Claude key verified and saved."); setClaude(""); }}>{busy ? <Spinner /> : null} Save</button></div>
          {d?.has_claude_key ? <button className="btn-ghost mt-2 text-xs" onClick={() => put({ claudeKey: null }, "Claude key removed.")}>Remove Claude key</button> : null}
          <p className="mt-3 text-[11px] text-ink-faint">Gemini&apos;s free tier has daily limits, and Google may use free-tier prompts to improve its products. Claude needs prepaid credit at console.anthropic.com.</p>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Mic className="h-5 w-5 text-brand-500" /> Voice — ElevenLabs</div>
          <p className="muted mb-3">Status: {d?.has_elevenlabs_key ? <StatusBadge status="connected" /> : d?.elevenlabsServerKey ? "using the server's key" : <StatusBadge status="expired" />}. Telugu voiceovers always use the <b>Bunty</b> voice.</p>
          <div className="flex gap-2"><input className="input" type="password" placeholder="ElevenLabs API key" value={eleven} onChange={(e) => setEleven(e.target.value)} /><button className="btn-primary" disabled={busy || !eleven} onClick={() => { put({ elevenlabsKey: eleven }, "ElevenLabs key saved."); setEleven(""); }}>Save</button></div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Field label="Default voice"><input className="input" value={voice.voice} onChange={(e) => setVoice({ ...voice, voice: e.target.value })} /></Field>
            <Field label="Language"><input className="input" value={voice.language} onChange={(e) => setVoice({ ...voice, language: e.target.value })} /></Field>
            <Field label="Model"><input className="input" value={voice.model} onChange={(e) => setVoice({ ...voice, model: e.target.value })} /></Field>
          </div>
          <button className="btn-outline mt-3" disabled={busy} onClick={() => put({ voiceDefaults: voice }, "Voice defaults saved.")}>Save voice defaults</button>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck className="h-5 w-5 text-brand-500" /> Platform setup</div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">Meta (Instagram + Facebook) <StatusBadge status={d?.integrations.meta ? "connected" : "expired"} /></li>
            <li className="flex items-center justify-between">Google (YouTube) <StatusBadge status={d?.integrations.google ? "connected" : "expired"} /></li>
          </ul>
          <div className="mt-3"><Notice>OAuth redirect URIs to register:<br /><code className="break-all text-xs">{d?.redirects.meta}</code><br /><code className="break-all text-xs">{d?.redirects.google}</code><br />Server keys are set in the <code>.env</code> file (see docs/SETUP_META.md and docs/SETUP_GOOGLE.md).</Notice></div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><Users className="h-5 w-5 text-brand-500" /> Team</div>
          <ul className="mb-3 space-y-1 text-sm">{members.data?.map((m) => <li key={m.id} className="flex justify-between"><span>{m.name} <span className="text-ink-faint">{m.email}</span></span><span className="capitalize text-ink-soft">{m.role}</span></li>)}</ul>
          <div className="flex gap-2">
            <input className="input" placeholder="teammate@company.com" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <select className="input !w-32" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
            <button className="btn-outline" disabled={busy || !invite.email} onClick={() => run(async () => { await api("/api/settings/members", { method: "POST", json: invite }); members.reload(); setInvite({ email: "", role: "editor" }); }, "Member added.")}>Add</button>
          </div>
          <p className="mt-2 text-xs text-ink-faint">Viewers can look; editors create and approve; admins manage accounts and automations; the owner manages keys.</p>
        </Card>
      </div>
      <Card className="mt-6">
        <div className="mb-3 flex items-center gap-2 font-display text-lg font-bold"><ScrollText className="h-5 w-5 text-brand-500" /> Audit log</div>
        {logs.error ? <p className="muted">{logs.error}</p> : null}
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm"><tbody>{logs.data?.map((l) => <tr key={l.id} className="border-b border-brand-50"><td className="py-2 pr-3 font-mono text-xs">{l.action}</td><td className="pr-3 text-ink-soft">{l.email ?? "—"}</td><td className="pr-3 text-xs text-ink-faint">{l.ip}</td><td className="text-xs text-ink-faint">{fmtDate(l.created_at)}</td></tr>)}</tbody></table>
        </div>
      </Card>
    </Page>
  );
}
