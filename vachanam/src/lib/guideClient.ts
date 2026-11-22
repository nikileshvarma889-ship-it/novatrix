import { fetch } from "expo/fetch";

/** Client for the Bible Guide edge function. Streams newline-delimited JSON (see supabase/functions/bible-guide/guide.ts). */
export type GuideLang = "en" | "te" | "both";
export type ChatTurn = { role: "user" | "assistant"; content: string };

const BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const OVERRIDE = process.env.EXPO_PUBLIC_GUIDE_URL;   // optional, e.g. a local test server
export const guideUrl = OVERRIDE || (BASE ? `${BASE.replace(/\/$/, "")}/functions/v1/bible-guide` : null);
export const guideConfigured = !!guideUrl;

export class GuideError extends Error { constructor(public code: string, message: string) { super(message); } }

export async function askGuide(turns: ChatTurn[], lang: GuideLang, onDelta: (text: string) => void, signal?: AbortSignal): Promise<void> {
  if (!guideUrl) throw new GuideError("not_configured", "The Bible Guide isn't connected yet.");
  let res: Response;
  try {
    res = (await fetch(guideUrl, {
      method: "POST", signal,
      headers: { "content-type": "application/json", ...(ANON ? { authorization: `Bearer ${ANON}`, apikey: ANON } : {}) },
      body: JSON.stringify({ messages: turns, lang }),
    })) as unknown as Response;
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw new GuideError("network", "No internet connection. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    let msg = "The Bible Guide is unavailable right now. Please try again.";
    try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
    throw new GuideError(res.status === 429 ? "rate_limited" : "server", msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const raw = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!raw) continue;
      const ev = JSON.parse(raw) as { t: string; text?: string; code?: string; message?: string };
      if (ev.t === "delta" && ev.text) onDelta(ev.text);
      else if (ev.t === "error") throw new GuideError(ev.code ?? "server", ev.message ?? "Something went wrong.");
      else if (ev.t === "done") return;
    }
    if (done) break;
  }
  throw new GuideError("server", "The answer was cut off. Please try again.");
}
