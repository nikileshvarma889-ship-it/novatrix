// Global knobs for the video. Tweak these instead of digging through scenes.

export const VIDEO = {
  id: "Novatrix",
  width: 1920,
  height: 1080,
  fps: 30,
};

export const BRAND = {
  name: "NOVATRIX",
  tagline: "Technology · AI · Possibilities",
  title: "7 FREE AI Tools",
  subtitle: "That Feel Illegal to Know in 2026",
  primary: "#7c5cff",
  secondary: "#22d3ee",
  hot: "#ff3d6e",
  bg: "#04050d",
};

export const AUDIO = {
  voiceoverVolume: 1,
  // Music is automatically ducked while narration is playing.
  musicVolumeUnderVoice: 0.08,
  musicVolumeNoVoice: 0.26,
  musicFadeInSeconds: 1.5,
  musicFadeOutSeconds: 4,
  sfxVolume: 0.35,
};

export const TIMING = {
  transitionFrames: 20,
  // Used to estimate narration length when no voiceover file is present.
  wordsPerSecond: 2.6,
  sentencePauseSeconds: 0.35,
  // Max words per on-screen subtitle line.
  maxWordsPerCue: 9,
};

// Shows "add your screen recording" hints on placeholder windows.
// Set to false for a clean render without clips.
export const SHOW_PLACEHOLDER_HINTS = true;

export const FONTS = {
  display: "Space Grotesk",
  body: "Inter",
};
