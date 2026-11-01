import type { Storyboard } from "../src/lib/ai/schemas";

export type Aspect = "9:16" | "16:9" | "1:1";
export const DIMENSIONS: Record<Aspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};
export const FPS = 30;

export type BrandKit = {
  name: string;
  colors: string[]; // [primary, secondary, dark]
  headingFont: string;
  bodyFont: string;
  logoUrl: string | null;
  introText: string;
  outroText: string;
  cta: string;
  website: string;
  contact: string;
};

export type Cue = { from: number; to: number; text: string }; // seconds, absolute

export type VideoProps = {
  storyboard: Storyboard;
  aspect: Aspect;
  brand: BrandKit;
  media: Record<string, string>; // media id -> URL reachable by the renderer
  sceneDurations: number[]; // seconds, final (stretched to fit voiceover)
  voiceoverUrl: string | null;
  musicUrl: string | null;
  sfxUrl: string | null;
  musicVolume: number;
  cues: Cue[];
  introSec: number;
  outroSec: number;
};
