// Storyboard → MP4 + thumbnail using Remotion (Three.js scenes render on the CPU
// through SwiftShader when no GPU is present).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { sql } from "../src/lib/db";
import { STORAGE_DIR, absPath, registerFile } from "../src/lib/storage";
import type { CoverDesign, Storyboard } from "../src/lib/ai/schemas";
import type { BrandKit, Cue, VideoProps, Aspect } from "../video/types";
import { DIMENSIONS, FPS } from "../video/types";
import { serve, startAssetServer } from "./assets";
import { isTelugu, TELUGU_VOICE } from "../src/lib/voices";
import { ffprobeDuration, mixVoiceover, moodBed, synthScenes, whoosh } from "./audio";

let bundled: Promise<string> | null = null;
const getBundle = () =>
  (bundled ??= bundle({ entryPoint: path.join(process.cwd(), "video/index.tsx"), webpackOverride: (c) => c }));

const T_SEC = 12 / 30; // transition overlap

/** Split narration into readable subtitle cues across [start, start+dur]. */
export function buildCues(text: string, start: number, dur: number, maxWords = 7): Cue[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords).join(" "));
  const total = chunks.reduce((a, c) => a + c.length, 0);
  let t = start;
  return chunks.map((c) => {
    const d = (dur * c.length) / total;
    const cue = { from: t, to: t + d, text: c };
    t += d;
    return cue;
  });
}

export type Timeline = { introSec: number; sceneStarts: number[]; sceneDurations: number[]; totalSec: number };

/** Everything the compositions need. With audio=false (cover only) no voice is synthesised. */
async function buildProps(videoId: string, audio: boolean) {
  const [v] = await sql`select * from videos where id = ${videoId}`;
  if (!v) throw new Error("Video not found");
  const sb = v.storyboard as Storyboard | null;
  if (!sb?.scenes?.length) throw new Error("This video has no storyboard yet.");
  const [b] = v.brand_id ? await sql`select * from brands where id = ${v.brand_id}` : [null];
  await startAssetServer();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "rw-render-"));

  // ---- media referenced by the storyboard ----
  const ids = [...new Set(sb.scenes.map((s) => s.imageMediaId).filter(Boolean) as string[])];
  const mediaRows = ids.length ? await sql`select id, path from media where workspace_id = ${v.workspace_id} and id = any(${ids})` : [];
  const media: Record<string, string> = {};
  for (const m of mediaRows) media[m.id] = serve(absPath(m.path));
  let logoUrl: string | null = null;
  if (b?.logo_media_id) {
    const [logo] = await sql`select path from media where id = ${b.logo_media_id}`;
    if (logo) logoUrl = serve(absPath(logo.path));
  }

  // ---- voiceover: scenes stretch to fit narration ----
  const opts = (v.render_options ?? {}) as { voice?: string; voiceoverMediaId?: string; music?: string; musicVolume?: number };
  // Telugu narration always uses ElevenLabs "Bunty" (Piper has no Telugu voice).
  const telugu = isTelugu(b?.language, ...sb.scenes.map((s) => s.voiceover));
  const voiceChoice = telugu ? `elevenlabs-name:${TELUGU_VOICE}` : opts.voice ?? "warm-male";
  const custom = opts.voiceoverMediaId;
  const planned = sb.scenes.map((s) => Math.max(2, Math.min(15, s.durationSec)));
  let durations = [...planned];
  const introSec = b?.intro_text ? 2 : 0;
  const outroSec = 3;
  let voiceoverUrl: string | null = null;
  const cues: Cue[] = [];
  const sceneStart = (i: number, d: number[]) => introSec - (introSec ? T_SEC : 0) + d.slice(0, i).reduce((a, x) => a + x - T_SEC, 0);

  if (custom) {
    const [m] = await sql`select path from media where id = ${custom} and workspace_id = ${v.workspace_id}`;
    if (m) voiceoverUrl = serve(absPath(m.path));
  } else if (audio && voiceChoice !== "none" && sb.scenes.some((s) => s.voiceover.trim())) {
    const clips = await synthScenes(path.join(work, "vo"), sb.scenes.map((s) => s.voiceover), voiceChoice, v.workspace_id);
    durations = planned.map((d, i) => Math.max(d, (clips[i]?.duration ?? 0) + 0.8));
    if (clips.some(Boolean)) {
    const total = sceneStart(sb.scenes.length, durations) + outroSec + 1;
    const placed = clips.map((c, i) => (c ? { file: c.file, at: sceneStart(i, durations) + 0.35 } : null)).filter(Boolean) as { file: string; at: number }[];
    const voFile = path.join(work, "voiceover.wav");
    mixVoiceover(voFile, placed, total);
    voiceoverUrl = serve(voFile);
    sb.scenes.forEach((s, i) => clips[i] && cues.push(...buildCues(s.voiceover, sceneStart(i, durations) + 0.35, clips[i]!.duration)));
    }
  }
  if (!cues.length) {
    // No synthetic voice: still subtitle the narration so the script reads on screen.
    sb.scenes.forEach((s, i) => s.voiceover.trim() && cues.push(...buildCues(s.voiceover, sceneStart(i, durations) + 0.3, durations[i] - 0.6)));
  }

  // ---- music ----
  const musicChoice = opts.music;
  let musicUrl: string | null = null;
  if (!audio) {
    // cover only: no music needed
  } else if (musicChoice && musicChoice !== "none" && !musicChoice.startsWith("mood:")) {
    const [m] = await sql`select path from media where id = ${musicChoice} and workspace_id = ${v.workspace_id}`;
    if (m) musicUrl = serve(absPath(m.path));
  } else if (musicChoice !== "none") {
    if (b?.music_media_id && !musicChoice) {
      const [m] = await sql`select path from media where id = ${b.music_media_id}`;
      if (m) musicUrl = serve(absPath(m.path));
    }
    musicUrl ??= serve(moodBed(musicChoice?.slice(5) || sb.musicMood));
  }

  const fonts = (b?.fonts ?? {}) as { heading?: string; body?: string };
  const brand: BrandKit = {
    name: b?.name ?? "",
    colors: ((b?.colors as string[]) ?? ["#5b6cff", "#a78bfa", "#0f172a"]).concat(["#5b6cff", "#a78bfa", "#0f172a"]).slice(0, 3),
    headingFont: `${fonts.heading ?? "Inter"}, Inter, "Noto Sans Telugu", Arial, sans-serif`,
    bodyFont: `${fonts.body ?? "Inter"}, Inter, "Noto Sans Telugu", Arial, sans-serif`,
    logoUrl,
    introText: b?.intro_text ?? "",
    outroText: b?.outro_text ?? "",
    cta: b?.cta ?? "",
    website: b?.website ?? "",
    contact: b?.contact ?? "",
  };
  const props: VideoProps = {
    storyboard: sb,
    aspect: v.aspect_ratio as Aspect,
    brand,
    media,
    sceneDurations: durations,
    voiceoverUrl,
    musicUrl,
    sfxUrl: audio ? serve(whoosh()) : null,
    musicVolume: opts.musicVolume ?? 0.5,
    cues,
    introSec,
    outroSec,
    cover: ((v.publish_kit as { cover?: CoverDesign } | null)?.cover ?? null) as CoverDesign | null,
  };
  const timeline: Timeline = {
    introSec,
    sceneStarts: sb.scenes.map((_, i) => +sceneStart(i, durations).toFixed(2)),
    sceneDurations: durations.map((d) => +d.toFixed(2)),
    totalSec: +(sceneStart(sb.scenes.length, durations) + outroSec).toFixed(2),
  };
  return { v, sb, props, timeline, work };
}

const chromiumOptions = { gl: "swangle" as const };
const browserExecutable = () => process.env.REMOTION_BROWSER_EXECUTABLE || null;

/** Renders the cover (JPEG: YouTube rejects thumbnails over 2 MB) and registers it as media. */
async function renderCoverFile(v: { id: string; workspace_id: string }, props: VideoProps): Promise<string> {
  const serveUrl = await getBundle();
  const thumbComp = await selectComposition({ serveUrl, id: "ReelwiseThumbnail", inputProps: props, chromiumOptions, browserExecutable: browserExecutable() });
  const thumbRel = path.join(v.workspace_id, `cover-${v.id}-${Date.now()}.jpg`);
  fs.mkdirSync(path.dirname(absPath(thumbRel)), { recursive: true });
  await renderStill({ serveUrl, composition: thumbComp, inputProps: props, output: absPath(thumbRel), imageFormat: "jpeg", jpegQuality: 88, chromiumOptions, browserExecutable: browserExecutable(), frame: 0 });
  return registerFile({ workspaceId: v.workspace_id, rel: thumbRel, filename: "cover.jpg", mime: "image/jpeg", kind: "image", source: "thumbnail", width: thumbComp.width, height: thumbComp.height });
}

/** Re-renders only the cover (after Claude designs it or the user edits it). */
export async function renderCover(videoId: string) {
  const { v, props, work } = await buildProps(videoId, false);
  try {
    return await renderCoverFile(v as never, props);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

export async function renderVideo(videoId: string, quality: "draft" | "final", onProgress: (p: number) => Promise<void>) {
  const { v, sb, props, timeline, work } = await buildProps(videoId, true);
  const serveUrl = await getBundle();
  const comp = await selectComposition({ serveUrl, id: "ReelwiseVideo", inputProps: props, chromiumOptions, browserExecutable: browserExecutable() });
  const rel = path.join(v.workspace_id, `video-${videoId}-${quality}-${Date.now()}.mp4`);
  fs.mkdirSync(path.dirname(absPath(rel)), { recursive: true });
  let last = 0;
  await renderMedia({
    serveUrl,
    composition: comp,
    inputProps: props,
    codec: "h264",
    crf: quality === "final" ? 18 : 26,
    pixelFormat: "yuv420p",
    audioCodec: "aac",
    scale: quality === "final" ? 1 : 0.5,
    outputLocation: absPath(rel),
    chromiumOptions,
    browserExecutable: browserExecutable(),
    concurrency: Number(process.env.RENDER_CONCURRENCY || 2),
    onProgress: ({ progress }) => {
      if (progress - last > 0.03 || progress === 1) {
        last = progress;
        void onProgress(progress);
      }
    },
  });
  const dims = DIMENSIONS[props.aspect];
  const scale = quality === "final" ? 1 : 0.5;
  const videoMedia = await registerFile({
    workspaceId: v.workspace_id,
    rel,
    filename: `${(sb.title || "video").replace(/[^\w -]+/g, "").slice(0, 60)}-${props.aspect.replace(":", "x")}.mp4`,
    mime: "video/mp4",
    kind: "video",
    source: "render",
    durationSec: ffprobeDuration(absPath(rel)),
    width: dims.width * scale,
    height: dims.height * scale,
  });
  const thumbMedia = await renderCoverFile(v as never, props);
  fs.rmSync(work, { recursive: true, force: true });
  return { videoMedia, thumbMedia, timeline };
}

export const coverOffsetMs = (t: Timeline | null, sceneIndex: number) =>
  t && t.sceneStarts[sceneIndex] != null ? Math.round((t.sceneStarts[sceneIndex] + (t.sceneDurations[sceneIndex] ?? 2) / 2) * 1000) : 0;

export { STORAGE_DIR, FPS };
