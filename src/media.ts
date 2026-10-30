// Types for src/generated/media-manifest.json, which `npm run media`
// (tools/scan-media.mjs) writes by scanning the public/ folder with FFmpeg.
import manifestJson from "./generated/media-manifest.json";

export type Silence = { start: number; end: number };
export type SrtCue = { start: number; end: number; text: string };

export type AudioFile = {
  file: string;
  duration: number;
  silences?: Silence[];
  srt?: SrtCue[];
};

export type VideoFile = { file: string; duration: number };

export type MediaManifest = {
  generatedAt: string | null;
  music: AudioFile | null;
  voiceover: Record<string, AudioFile>;
  clips: Record<string, VideoFile>;
  sfx: Record<string, AudioFile>;
  logo: string | null;
};

export const MEDIA = manifestJson as unknown as MediaManifest;
