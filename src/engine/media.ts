// Types for src/generated/media-manifest.json, written by `npm run media`
// (tools/scan-media.mjs), which measures everything in public/ with FFmpeg.
import manifestJson from "../generated/media-manifest.json";

export type Silence = { start: number; end: number };
export type SrtCue = { start: number; end: number; text: string };

export type AudioFile = { file: string; duration: number; silences?: Silence[]; srt?: SrtCue[] };
export type VisualFile = { file: string; type: "image" | "video"; duration?: number; width: number; height: number };

export type ProjectMedia = {
  /** Narration per cut, keyed by scene id. */
  voiceover: Record<string, Record<string, AudioFile>>;
  /** Footage keyed by file name inside footage/. */
  footage: Record<string, VisualFile>;
  /** Music keyed by file name inside music/. */
  music: Record<string, AudioFile>;
  sfx: Record<string, AudioFile>;
};

export type MediaManifest = {
  generatedAt: string | null;
  brand: { music: Record<string, AudioFile>; sfx: Record<string, AudioFile>; logo: string | null };
  projects: Record<string, ProjectMedia>;
};

export const MEDIA = manifestJson as unknown as MediaManifest;

const EMPTY: ProjectMedia = { voiceover: {}, footage: {}, music: {}, sfx: {} };
export const projectMedia = (slug: string): ProjectMedia => MEDIA.projects[slug] ?? EMPTY;

/** Project SFX override the shared brand library. */
export const findSfx = (slug: string, id: string): AudioFile | undefined =>
  projectMedia(slug).sfx[id] ?? MEDIA.brand.sfx[id];

/** The cut's chosen track, else the project's first track, else the brand track. */
export const findMusic = (slug: string, preferred?: string): AudioFile | undefined => {
  const pm = projectMedia(slug).music;
  if (preferred && pm[preferred]) return pm[preferred];
  const first = Object.keys(pm).sort()[0];
  if (first) return pm[first];
  const brand = Object.keys(MEDIA.brand.music).sort()[0];
  return brand ? MEDIA.brand.music[brand] : undefined;
};
