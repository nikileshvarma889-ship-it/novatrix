import { route, json } from "@/lib/http";
import { elevenKeyFor, listVoices, voiceDefaultsFor } from "@/lib/elevenlabs";
import { VOICE_OPTIONS } from "@/lib/voices";

/** Voices the creator can pick: local Piper presets + the workspace's ElevenLabs voices. */
export const GET = route({}, async ({ user }) => {
  const key = await elevenKeyFor(user.workspaceId);
  const d = await voiceDefaultsFor(user.workspaceId);
  const options: { id: string; label: string }[] = [];
  let elevenError: string | null = null;
  if (key) {
    options.push({ id: "elevenlabs", label: `ElevenLabs — ${d.voice || "default voice"}${d.language ? ` (${d.language})` : ""}` });
    try {
      for (const v of await listVoices(key)) options.push({ id: `elevenlabs:${v.voice_id}`, label: `ElevenLabs — ${v.name}` });
    } catch (e) {
      elevenError = (e as Error).message;
    }
  }
  return json({ options: [...options, ...VOICE_OPTIONS], elevenlabs: { configured: Boolean(key), error: elevenError, defaults: d } });
});
