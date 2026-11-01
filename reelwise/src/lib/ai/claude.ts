// All AI calls go through generate(). The provider is Claude or Google Gemini:
// the workspace's choice in Settings, else the server's AI_PROVIDER, else whichever has a key.
// Keys come from the workspace (encrypted, Settings) or the server environment. Never runs without a key.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType, z } from "zod/v4";
import { sql } from "../db";
import { decrypt } from "../crypto";

export const MODEL = "claude-opus-5-5";

export { AiError, AiNotConfigured } from "./errors";
import { AiError, AiNotConfigured } from "./errors";
import { geminiGenerate, GEMINI_MODEL } from "./gemini";

export type AiProvider = "claude" | "gemini";
export const AI_NAMES: Record<AiProvider, string> = { claude: "Claude", gemini: "Gemini" };

/** Turns API errors into plain messages, and says whether a retry can succeed. */
export function explainAiError(e: unknown): AiError | null {
  if (e instanceof AiError) return e;
  // Connection errors are a subclass of APIError, so check them first.
  if (e instanceof Anthropic.APIConnectionError) return new AiError("Could not reach the Claude API. Check the server's internet access.", false);
  if (!(e instanceof Anthropic.APIError)) return null;
  const detail = (e.error as { error?: { message?: string } } | undefined)?.error?.message ?? e.message;
  if (/credit balance is too low|billing/i.test(detail))
    return new AiError("Your Anthropic account has no credit left. Add credits at console.anthropic.com → Plans & Billing, then press Try again.");
  if (e instanceof Anthropic.AuthenticationError) return new AiError("The Claude API key was rejected. Check it in Settings → AI.");
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError(`This Claude API key is not allowed to do that: ${detail}`);
  if (e instanceof Anthropic.RateLimitError) return new AiError("Claude is rate-limiting this key. It will retry automatically in a minute.", false);
  if (e.status === 529 || (e.status ?? 0) >= 500) return new AiError("Claude is temporarily overloaded. It will retry automatically.", false);
  return new AiError(`Claude could not handle this request: ${detail}`);
}

/** Which AI this workspace uses, and its key (null when none is configured). */
export async function resolveAi(workspaceId: string): Promise<{ provider: AiProvider; key: string | null; model: string }> {
  const [row] = await sql`select anthropic_key_enc, gemini_key_enc, ai_provider from workspace_settings where workspace_id = ${workspaceId}`;
  const claudeKey = row?.anthropic_key_enc ? decrypt(row.anthropic_key_enc) : process.env.ANTHROPIC_API_KEY || null;
  const geminiKey = row?.gemini_key_enc ? decrypt(row.gemini_key_enc) : process.env.GEMINI_API_KEY || null;
  const forced = (row?.ai_provider || process.env.AI_PROVIDER || "") as AiProvider | "";
  const provider: AiProvider = forced === "claude" || forced === "gemini" ? forced : claudeKey ? "claude" : geminiKey ? "gemini" : "claude";
  return { provider, key: provider === "claude" ? claudeKey : geminiKey, model: provider === "claude" ? MODEL : GEMINI_MODEL() };
}

export async function aiStatus(workspaceId: string) {
  const r = await resolveAi(workspaceId);
  return { provider: r.provider, name: AI_NAMES[r.provider], model: r.model, ready: Boolean(r.key) };
}

export async function clientFor(workspaceId: string) {
  const r = await resolveAi(workspaceId);
  if (!r.key || r.provider !== "claude") throw new AiNotConfigured("claude");
  return new Anthropic({ apiKey: r.key });
}

/** One structured call: returns data validated against `schema`. */
export async function generate<T extends ZodType>(workspaceId: string, opts: { system: string; prompt: string; schema: T; effort?: "low" | "medium" | "high"; images?: { mime: string; data: string }[] }): Promise<z.infer<T>> {
  const ai = await resolveAi(workspaceId);
  if (!ai.key) throw new AiNotConfigured(ai.provider);
  if (ai.provider === "gemini") return geminiGenerate(ai.key, opts);
  const client = new Anthropic({ apiKey: ai.key });
  const content: Anthropic.ContentBlockParam[] = [
    ...(opts.images ?? []).map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.mime as "image/png", data: img.data } })),
    { type: "text", text: opts.prompt },
  ];
  try {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: opts.system,
      output_config: { format: zodOutputFormat(opts.schema), effort: opts.effort ?? "medium" },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") throw new AiError("Claude declined this request. Please rephrase the instruction.");
    if (res.stop_reason === "max_tokens") throw new AiError("The response was too long. Try a shorter video or fewer scenes.");
    if (!res.parsed_output) throw new AiError("Claude returned an unexpected format. Please try again.");
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    throw explainAiError(e) ?? e;
  }
}

/** Brand guidelines block shared by every prompt (only the selected brand). */
export function brandBrief(b: Record<string, unknown> | null) {
  if (!b) return "No brand profile selected. Keep the tone neutral and professional.";
  const lines = [
    `Brand name: ${b.name}`,
    b.description && `About: ${b.description}`,
    b.audience && `Target audience: ${b.audience}`,
    `Language: ${b.language}`,
    b.characters && `Brand characters: ${b.characters}`,
    b.cta && `Call to action: ${b.cta}`,
    b.website && `Website: ${b.website}`,
    b.contact && `Contact: ${b.contact}`,
    b.intro_text && `Intro line: ${b.intro_text}`,
    b.outro_text && `Outro line: ${b.outro_text}`,
    b.voice_pref && `Voice preference: ${b.voice_pref}`,
    b.music_pref && `Music preference: ${b.music_pref}`,
    b.restrictions && `CONTENT RESTRICTIONS (must follow): ${b.restrictions}`,
  ];
  return lines.filter(Boolean).join("\n");
}
