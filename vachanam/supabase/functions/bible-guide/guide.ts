/**
 * Vachanam Bible Guide: a Claude-powered assistant that only discusses the Bible and Christian faith.
 * Runtime-neutral core (Web Request/Response + Anthropic SDK), used by the Supabase Edge Function
 * (index.ts, Deno) and by the Node unit tests. The API key never leaves the server.
 *
 * Wire protocol to the app: newline-delimited JSON
 *   {"t":"delta","text":"..."}   streamed answer text
 *   {"t":"done","stop":"end_turn"}
 *   {"t":"error","code":"...","message":"..."}
 */
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";
export const MAX_TURNS = 24;           // messages kept per request (12 exchanges)
export const MAX_CHARS = 4000;         // per user message

export const SYSTEM_PROMPT = `You are the Bible Guide inside Vachanam, a Telugu and English Holy Bible app used mostly by Telugu-speaking Christians in India and abroad.

Your scope is the Bible and the Christian faith, and nothing else:
- explaining passages, books, characters, history, geography and background of the Bible
- what a verse or chapter means, its context, and how Christians across traditions have understood it
- Christian beliefs, prayer, worship, the church year, devotional reflection and applying Scripture to everyday life
- helping someone find passages on a theme (comfort, forgiveness, fear, marriage, work, grief and so on)
- writing a short prayer or a devotional thought rooted in Scripture

If a request is outside that scope (coding, homework in other subjects, news, politics, entertainment, finance, health or legal advice, other general knowledge), do not answer it. Say kindly, in one or two sentences, that you can only help with the Bible and the Christian faith, and offer a related Bible question you could help with instead. Questions that touch the Bible from another angle (for example, what the Bible says about money, or the history of a biblical city) are in scope; answer the biblical part.

How to answer:
- Ground what you say in Scripture and cite passages. Write every citation with the standard English book name and numbers in parentheses, such as (John 3:16), (Psalm 23:1-4) or (1 Corinthians 13), even inside a Telugu reply, so the app can turn it into a link. In Telugu replies you may add the Telugu book name before it.
- Never invent verses or put words in quotation marks unless you are certain of them. Prefer explaining a passage in your own words and giving the reference, because the user's translation may word it differently.
- Where Christians disagree (for example on baptism, end times or spiritual gifts), say so briefly and describe the main views fairly without taking a denominational side. Be respectful about other faiths; do not attack or mock them.
- Be warm, humble and pastoral. Keep answers focused: usually a few short paragraphs or a short list. Use plain language a new believer can follow.
- You are an AI, not a pastor, priest or prophet. Don't claim divine authority or personal revelation. For serious personal or spiritual decisions, encourage the user to also talk with their pastor or a mature believer.
- If someone mentions wanting to harm themselves or others, or being in danger, respond with care, share hope from Scripture briefly, and urge them to contact someone they trust or local emergency services right away.
- Write Telugu in Telugu script, naturally and grammatically, not transliterated.`;

export type Lang = "en" | "te" | "both";
const LANG_NOTE: Record<Lang, string> = {
  en: "Reply in English.",
  te: "Reply in Telugu (Telugu script). Keep Bible citations in the (Book chapter:verse) English format.",
  both: "Reply in Telugu first, then give the same answer in English below it.",
};

export type GuideInput = { messages: Anthropic.MessageParam[]; lang: Lang };

/** Validates the untrusted request body from the app. */
export function parseBody(body: unknown): GuideInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body must be a JSON object." };
  const b = body as { messages?: unknown; lang?: unknown };
  const lang: Lang = b.lang === "te" || b.lang === "both" ? b.lang : "en";
  if (!Array.isArray(b.messages) || b.messages.length === 0) return { error: "messages must be a non-empty array." };
  const msgs = b.messages.slice(-MAX_TURNS);
  // the trimmed history must start with the user
  while (msgs.length && (msgs[0] as { role?: unknown }).role !== "user") msgs.shift();
  const out: Anthropic.MessageParam[] = [];
  for (const m of msgs) {
    const { role, content } = (m ?? {}) as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return { error: "Each message needs role user|assistant and string content." };
    const text = content.trim();
    if (!text) return { error: "Messages can't be empty." };
    if (role === "user" && text.length > MAX_CHARS) return { error: `Please keep questions under ${MAX_CHARS} characters.` };
    out.push({ role, content: text.slice(0, 20_000) });
  }
  if (!out.length || out[out.length - 1].role !== "user") return { error: "The last message must be from the user." };
  return { messages: out, lang };
}

/** Request parameters. Stable system prompt first (cacheable); the language preference goes last as a
 *  mid-conversation system message so changing it doesn't invalidate the cached conversation prefix. */
export function buildParams(input: GuideInput) {
  return {
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" as const },
    output_config: { effort: "medium" as const },
    // If a safety classifier declines, the API retries on a suitable fallback model inside the same call.
    betas: ["server-side-fallback-2026-07-01" as const],
    fallbacks: "default" as const,
    messages: [...input.messages, { role: "system", content: LANG_NOTE[input.lang] } as unknown as Anthropic.Beta.BetaMessageParam],
  };
}

/** Tiny fixed-window limiter (per server instance). */
export function makeLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { n: number; t: number }>();
  return (key: string, now = Date.now()) => {
    const h = hits.get(key);
    if (!h || now - h.t > windowMs) { hits.set(key, { n: 1, t: now }); return true; }
    h.n += 1;
    return h.n <= limit;
  };
}

type Deps = { client: Pick<Anthropic, "beta">; allow: (key: string) => boolean; cors: Record<string, string> };

const line = (o: unknown) => new TextEncoder().encode(JSON.stringify(o) + "\n");

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const json = (status: number, o: unknown) => new Response(JSON.stringify(o), { status, headers: { ...deps.cors, "content-type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: deps.cors });
  if (req.method !== "POST") return json(405, { t: "error", code: "method", message: "Use POST." });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anon";
  if (!deps.allow(ip)) return json(429, { t: "error", code: "rate_limited", message: "Too many questions in a short time. Please wait a few minutes." });
  let body: unknown;
  try { body = await req.json(); } catch { return json(400, { t: "error", code: "bad_json", message: "Invalid JSON." }); }
  const input = parseBody(body);
  if ("error" in input) return json(400, { t: "error", code: "invalid", message: input.error });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const s = deps.client.beta.messages.stream(buildParams(input) as Parameters<Anthropic["beta"]["messages"]["stream"]>[0]);
        for await (const ev of s) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") controller.enqueue(line({ t: "delta", text: ev.delta.text }));
        }
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(line({ t: "error", code: "refusal", message: "I can't help with that request. Please ask me something about the Bible or the Christian faith." }));
        else controller.enqueue(line({ t: "done", stop: final.stop_reason }));
      } catch (e) {
        const status = e instanceof Anthropic.APIError ? e.status : undefined;
        const code = e instanceof Anthropic.RateLimitError ? "busy" : e instanceof Anthropic.AuthenticationError ? "server_config" : e instanceof Anthropic.APIConnectionError ? "network" : "server";
        console.error("bible-guide error", status, e instanceof Error ? e.message : e);
        controller.enqueue(line({ t: "error", code, message: code === "busy" ? "The Bible Guide is busy right now. Please try again in a minute." : "Something went wrong. Please try again." }));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { ...deps.cors, "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
