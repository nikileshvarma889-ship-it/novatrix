// Voice choices offered in the UI (must match worker/audio.ts VOICES keys).
export const VOICE_OPTIONS = [
  { id: "warm-male", label: "Warm male" },
  { id: "bright-female", label: "Bright female" },
  { id: "calm-female", label: "Calm female" },
  { id: "neutral-male", label: "Neutral male" },
  { id: "none", label: "No voiceover (subtitles only)" },
];
export const MUSIC_MOODS = ["upbeat", "inspiring", "calm", "dramatic", "corporate"];

/** Telugu narration must use the ElevenLabs "Bunty" voice (product rule). */
export const TELUGU_VOICE = "Bunty";
export const isTelugu = (...texts: (string | null | undefined)[]) => texts.some((t) => !!t && (/telugu|తెలుగు/i.test(t) || /[ఀ-౿]/.test(t)));
