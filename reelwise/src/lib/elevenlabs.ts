// ElevenLabs text-to-speech (official REST API). Used for natural voiceovers,
// including Telugu with eleven_v3. Docs: elevenlabs.io/docs/api-reference
import { sql } from "./db";
import { decrypt } from "./crypto";

const BASE = "https://api.elevenlabs.io";

export class VoiceError extends Error {}

async function call<T>(key: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { "xi-api-key": key, ...(init.headers ?? {}) } });
  } catch {
    throw new VoiceError("Could not reach ElevenLabs. Check the server's internet access (api.elevenlabs.io must be allowed).");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: { status?: string; message?: string } | string };
    const d = typeof body.detail === "string" ? { message: body.detail } : body.detail ?? {};
    if (res.status === 401) throw new VoiceError("The ElevenLabs API key was rejected. Check it in Settings → Voice.");
    if (d.status === "quota_exceeded") throw new VoiceError("Your ElevenLabs character quota is used up for this period.");
    if (d.status === "missing_permissions") throw new VoiceError(`The ElevenLabs key lacks a permission: ${d.message}`);
    throw new VoiceError(`ElevenLabs error (${res.status}): ${d.message ?? d.status ?? "unknown"}`);
  }
  return (path.startsWith("/v1/text-to-speech") ? ((await res.arrayBuffer()) as unknown) : await res.json()) as T;
}

export type ElevenVoice = { voice_id: string; name: string; labels?: Record<string, string>; category?: string };

export const listVoices = async (key: string) => (await call<{ voices: ElevenVoice[] }>(key, "/v1/voices")).voices;

/**
 * Resolve a voice by ID or name. Looks in the account first, then in the
 * public Voice Library (adding the voice to the account so it can be used).
 */
export async function resolveVoice(key: string, nameOrId: string, language?: string): Promise<ElevenVoice> {
  const mine = await listVoices(key);
  const want = nameOrId.trim().toLowerCase();
  const hit = mine.find((v) => v.voice_id === nameOrId) ?? mine.find((v) => v.name.toLowerCase() === want) ?? mine.find((v) => v.name.toLowerCase().startsWith(want));
  if (hit) return hit;
  const q = new URLSearchParams({ search: nameOrId, page_size: "20" });
  if (language) q.set("language", language);
  const shared = await call<{ voices: { voice_id: string; public_owner_id: string; name: string; language?: string }[] }>(key, `/v1/shared-voices?${q}`);
  const lib = shared.voices.find((v) => v.name.toLowerCase().startsWith(want)) ?? shared.voices[0];
  if (!lib) throw new VoiceError(`No ElevenLabs voice named "${nameOrId}" was found in your account or the Voice Library.`);
  const added = await call<{ voice_id: string }>(key, `/v1/voices/add/${lib.public_owner_id}/${lib.voice_id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ new_name: lib.name }),
  });
  return { voice_id: added.voice_id, name: lib.name };
}

/** Synthesise speech; returns MP3 bytes. */
export async function speak(key: string, voiceId: string, text: string, opts: { model?: string; language?: string } = {}) {
  const model = opts.model || process.env.ELEVENLABS_MODEL || "eleven_v3";
  const send = (withLang: boolean) =>
    call<ArrayBuffer>(key, `/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model, ...(withLang && opts.language ? { language_code: opts.language } : {}) }),
    });
  try {
    return Buffer.from(await send(true));
  } catch (e) {
    // Some models reject an explicit language code; the text itself carries the language.
    if (opts.language && e instanceof VoiceError && /language/i.test(e.message)) return Buffer.from(await send(false));
    throw e;
  }
}

/** The key to use for a workspace: its own saved key, else the server's. */
export async function elevenKeyFor(workspaceId: string) {
  const [row] = await sql`select elevenlabs_key_enc from workspace_settings where workspace_id = ${workspaceId}`;
  return row?.elevenlabs_key_enc ? decrypt(row.elevenlabs_key_enc) : process.env.ELEVENLABS_API_KEY || null;
}

export async function voiceDefaultsFor(workspaceId: string) {
  const [row] = await sql`select voice_defaults from workspace_settings where workspace_id = ${workspaceId}`;
  const d = (row?.voice_defaults ?? {}) as { voice?: string; language?: string; model?: string };
  return {
    voice: d.voice || process.env.ELEVENLABS_DEFAULT_VOICE || "",
    language: d.language || process.env.ELEVENLABS_LANGUAGE || "",
    model: d.model || process.env.ELEVENLABS_MODEL || "eleven_v3",
  };
}
