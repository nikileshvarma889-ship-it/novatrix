// Google Gemini (Generative Language API, REST). Same contract as the Claude path:
// a JSON schema goes in, data validated against the zod schema comes out.
import { z, type ZodType } from "zod/v4";
import { AiError } from "./errors";

export const GEMINI_MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-latest";
/** Used when the main model is busy (503), rate-limited (429) or too slow. Empty disables the fallback. */
export const GEMINI_FALLBACK_MODEL = () => process.env.GEMINI_FALLBACK_MODEL ?? "gemini-flash-lite-latest";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

type Part = { text?: string; thought?: boolean; inline_data?: { mime_type: string; data: string } };
type GenRes = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code: number; status: string; message: string; details?: { reason?: string }[] };
};

/** Gemini accepts a subset of JSON Schema; drop the keywords it rejects. */
export function toGeminiSchema(schema: ZodType): unknown {
  const strip = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(strip);
    if (n && typeof n === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(n)) if (k !== "$schema" && k !== "additionalProperties") out[k] = strip(v);
      return out;
    }
    return n;
  };
  return strip(z.toJSONSchema(schema));
}

export function explainGeminiError(status: number, err: GenRes["error"]): AiError {
  const msg = err?.message ?? `HTTP ${status}`;
  const reason = err?.details?.find((d) => d.reason)?.reason ?? "";
  if (/API_KEY_INVALID|API key not valid|API_KEY_/.test(reason + msg) || status === 401) return new AiError("The Gemini API key was rejected. Check it in Settings → AI.");
  if (status === 403) return new AiError(`This Gemini API key is not allowed to do that: ${msg}`);
  if (status === 429) return new AiError("Gemini's free-tier limit was reached. It will retry automatically; if it keeps happening, wait until the daily limit resets or enable billing in Google AI Studio.", false);
  if (status === 404) return new AiError(`The Gemini model "${GEMINI_MODEL()}" is not available to this key. Set GEMINI_MODEL to a model your key can use.`);
  if (status >= 500) return new AiError("Gemini is temporarily unavailable. It will retry automatically.", false);
  return new AiError(`Gemini could not handle this request: ${msg}`);
}

async function callModel(key: string, model: string, body: unknown, timeoutMs: number) {
  try {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { res, data: (await res.json().catch(() => ({}))) as GenRes };
  } catch (e) {
    const timeout = (e as Error).name === "TimeoutError";
    return { res: null, data: {} as GenRes, timeout };
  }
}

export async function geminiGenerate<T extends ZodType>(
  key: string,
  opts: { system: string; prompt: string; schema: T; effort?: "low" | "medium" | "high"; images?: { mime: string; data: string }[] },
): Promise<z.infer<T>> {
  const base = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [...(opts.images ?? []).map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } })), { text: opts.prompt }] }],
  };
  const config = { responseMimeType: "application/json", responseJsonSchema: toGeminiSchema(opts.schema), maxOutputTokens: 16000 };
  const primary = GEMINI_MODEL();
  const fallback = GEMINI_FALLBACK_MODEL();
  // Less thinking keeps the free tier responsive; "high" effort asks for more.
  let out = await callModel(key, primary, { ...base, generationConfig: { ...config, thinkingConfig: { thinkingLevel: opts.effort === "high" ? "high" : "low" } } }, fallback ? 150_000 : 240_000);
  // Some models reject thinkingConfig: retry the same model without it.
  if (out.res?.status === 400 && /thinking/i.test(out.data.error?.message ?? "")) out = await callModel(key, primary, { ...base, generationConfig: config }, 240_000);
  const busy = !out.res ? Boolean(out.timeout) : [429, 500, 503, 504].includes(out.res.status);
  if (busy && fallback && fallback !== primary) out = await callModel(key, fallback, { ...base, generationConfig: config }, 120_000);
  if (!out.res) throw new AiError(out.timeout ? "Gemini took too long to answer. It will try again." : "Could not reach the Gemini API. Check the server's internet access.", false);
  const { res, data } = out;
  if (!res.ok) throw explainGeminiError(res.status, data.error);
  if (data.promptFeedback?.blockReason) throw new AiError("Gemini declined this request. Please rephrase the instruction.");
  const c = data.candidates?.[0];
  const reason = c?.finishReason ?? "";
  if (/SAFETY|PROHIBITED|BLOCKLIST|SPII|RECITATION/.test(reason)) throw new AiError("Gemini declined this request. Please rephrase the instruction.");
  if (reason === "MAX_TOKENS") throw new AiError("The response was too long. Try a shorter video or fewer scenes.");
  const text = (c?.content?.parts ?? []).filter((p) => !p.thought && p.text).map((p) => p.text).join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError("Gemini returned an unexpected format. It will try again.", false);
  }
  const ok = opts.schema.safeParse(parsed);
  if (!ok.success) throw new AiError(`Gemini returned incomplete data (${ok.error.issues[0]?.path.join(".")}: ${ok.error.issues[0]?.message}). It will try again.`, false);
  return ok.data;
}

/** Cheap check used when a key is saved in Settings. */
export async function verifyGeminiKey(key: string) {
  const res = await fetch(`${BASE}/models/${GEMINI_MODEL()}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with OK." }] }], generationConfig: { maxOutputTokens: 200 } }),
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
  if (!res) return; // network trouble doesn't mean the key is bad
  if (!res.ok) {
    const e = explainGeminiError(res.status, ((await res.json().catch(() => ({}))) as GenRes).error);
    if (e.permanent) throw e;
  }
}
