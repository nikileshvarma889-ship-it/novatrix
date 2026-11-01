import { z } from "zod/v4";
import Anthropic from "@anthropic-ai/sdk";
import { aiStatus, explainAiError } from "@/lib/ai/claude";
import { verifyGeminiKey } from "@/lib/ai/gemini";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { integrationStatus, env } from "@/lib/env";
import { META_REDIRECT } from "@/lib/social/meta";
import { GOOGLE_REDIRECT } from "@/lib/social/google";

export const GET = route({}, async ({ user }) => {
  const [s] = await sql`select timezone, anthropic_key_enc is not null as has_claude_key, gemini_key_enc is not null as has_gemini_key, ai_provider, elevenlabs_key_enc is not null as has_elevenlabs_key, voice_defaults
                        from workspace_settings where workspace_id = ${user.workspaceId}`;
  return json({
    ...s,
    elevenlabsServerKey: Boolean(process.env.ELEVENLABS_API_KEY),
    geminiServerKey: Boolean(process.env.GEMINI_API_KEY),
    ai: await aiStatus(user.workspaceId),
    voiceDefaults: { voice: process.env.ELEVENLABS_DEFAULT_VOICE ?? "", language: process.env.ELEVENLABS_LANGUAGE ?? "", model: process.env.ELEVENLABS_MODEL ?? "eleven_v3", ...(s?.voice_defaults ?? {}) },
    integrations: integrationStatus(),
    redirects: { meta: META_REDIRECT(), google: GOOGLE_REDIRECT() },
    appUrl: env.appUrl,
  });
});

const Put = z.object({
  claudeKey: z.string().trim().max(300).nullable().optional(),
  geminiKey: z.string().trim().max(300).nullable().optional(),
  aiProvider: z.enum(["claude", "gemini", "auto"]).optional(),
  elevenlabsKey: z.string().trim().max(300).nullable().optional(),
  voiceDefaults: z.object({ voice: z.string().trim().max(80), language: z.string().trim().max(10), model: z.string().trim().max(60) }).optional(),
  timezone: z.string().max(60).optional(),
});

export const PUT = route({ min: "owner", limit: [10, 60_000] }, async ({ req, user, ip }) => {
  const d = await body(req, Put);
  if (d.claudeKey) {
    // Verify before saving so users get immediate feedback.
    // A one-token request also catches keys whose account has no credit (listing models does not).
    try {
      await new Anthropic({ apiKey: d.claudeKey }).messages.create({ model: "claude-haiku-5-5", max_tokens: 1, messages: [{ role: "user", content: "hi" }] });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new HttpError(400, "That Claude API key was rejected by Anthropic.");
      const ai = explainAiError(e);
      // Connection problems and overloads don't mean the key is bad: save it anyway.
      if (ai?.permanent) throw new HttpError(400, ai.message);
    }
  }
  if (d.geminiKey) {
    try {
      await verifyGeminiKey(d.geminiKey);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  }
  await sql`insert into workspace_settings (workspace_id) values (${user.workspaceId}) on conflict do nothing`;
  if (d.geminiKey !== undefined) await sql`update workspace_settings set gemini_key_enc = ${d.geminiKey ? encrypt(d.geminiKey) : null}, updated_at = now() where workspace_id = ${user.workspaceId}`;
  if (d.aiProvider) await sql`update workspace_settings set ai_provider = ${d.aiProvider === "auto" ? null : d.aiProvider}, updated_at = now() where workspace_id = ${user.workspaceId}`;
  if (d.claudeKey !== undefined) await sql`update workspace_settings set anthropic_key_enc = ${d.claudeKey ? encrypt(d.claudeKey) : null}, updated_at = now() where workspace_id = ${user.workspaceId}`;
  if (d.timezone) await sql`update workspace_settings set timezone = ${d.timezone} where workspace_id = ${user.workspaceId}`;
  if (d.elevenlabsKey !== undefined) await sql`update workspace_settings set elevenlabs_key_enc = ${d.elevenlabsKey ? encrypt(d.elevenlabsKey) : null}, updated_at = now() where workspace_id = ${user.workspaceId}`;
  if (d.voiceDefaults) await sql`update workspace_settings set voice_defaults = ${sql.json(d.voiceDefaults as never)}, updated_at = now() where workspace_id = ${user.workspaceId}`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "settings.update", ip, meta: { claudeKey: d.claudeKey === undefined ? "unchanged" : d.claudeKey ? "set" : "removed", elevenlabsKey: d.elevenlabsKey === undefined ? "unchanged" : d.elevenlabsKey ? "set" : "removed", voiceDefaults: d.voiceDefaults ?? "unchanged" } });
  return json({ ok: true });
});
