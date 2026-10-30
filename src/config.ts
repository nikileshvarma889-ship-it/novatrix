// Global production settings for THE UNTOLD. Per-video content lives in
// src/projects/<slug>/; this file holds the knobs shared by every film.

export const VIDEO = {
  fps: 30,
  formats: {
    landscape: { width: 1920, height: 1080 },
    vertical: { width: 1080, height: 1920 },
  },
};

export const AUDIO = {
  voiceoverVolume: 1,
  // Music is automatically ducked while narration plays.
  musicVolumeUnderVoice: 0.12,
  musicVolumeNoVoice: 0.32,
  musicFadeInSeconds: 2,
  musicFadeOutSeconds: 5,
  sfxVolume: 0.55,
};

export const TIMING = {
  defaultLeadIn: 0.6,
  defaultTail: 0.9,
  sentencePauseSeconds: 0.45,
  // Speaking rate used to estimate timing before a voiceover is recorded.
  charsPerSecond: { te: 11, en: 15, default: 13 } as Record<string, number>,
  // Max words per on-screen subtitle.
  maxWordsPerCue: 8,
};

/** Show "footage needed" slates for missing assets (turn off for clean previews). */
export const SHOW_PLACEHOLDER_SLATES = true;

/** On-screen provenance labels per asset kind. "" hides the label. */
export const PROVENANCE_LABELS = {
  archival: "Archive photograph",
  stock: "Representative footage",
  illustration: "Illustration",
  reconstruction: "Dramatization",
  "ai-generated": "AI-generated illustration",
};
