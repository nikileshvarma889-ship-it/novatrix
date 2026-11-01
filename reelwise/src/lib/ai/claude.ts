// All Claude calls go through here. Uses the workspace's own key when saved in
// Settings, otherwise the server's ANTHROPIC_API_KEY. Never runs without a key.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType, z } from "zod/v4";
import { sql } from "../db";
import { decrypt } from "../crypto";

export const MODEL = "claude-opus-5-5";

export class AiNotConfigured extends Error {
  constructor() {
    super("No Claude API key is configured. Add one in Settings → AI (or set ANTHROPIC_API_KEY on the server).");
  }
}

export async function clientFor(workspaceId: string) {
  const [row] = await sql`select anthropic_key_enc from workspace_settings where workspace_id = ${workspaceId}`;
  const key = row?.anthropic_key_enc ? decrypt(row.anthropic_key_enc) : process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiNotConfigured();
  return new Anthropic({ apiKey: key });
}

/** One structured call: returns data validated against `schema`. */
export async function generate<T extends ZodType>(workspaceId: string, opts: { system: string; prompt: string; schema: T; effort?: "low" | "medium" | "high"; images?: { mime: string; data: string }[] }): Promise<z.infer<T>> {
  const client = await clientFor(workspaceId);
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
    if (res.stop_reason === "refusal") throw new Error("Claude declined this request. Please rephrase the instruction.");
    if (res.stop_reason === "max_tokens") throw new Error("The response was too long. Try a shorter video or fewer scenes.");
    if (!res.parsed_output) throw new Error("Claude returned an unexpected format. Please try again.");
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("The Claude API key was rejected. Check it in Settings → AI.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Claude is rate-limiting this key. Please retry in a minute.");
    if (e instanceof Anthropic.APIError) throw new Error(`Claude API error (${e.status}): ${e.message}`);
    throw e;
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
