#!/usr/bin/env node
// Scans public/ for narration, footage, music, SFX and logo, measures them
// with FFprobe, detects pauses in narration with FFmpeg, and writes
// src/generated/media-manifest.json for the video engine.
//
//   public/brand/music/*            shared music library
//   public/brand/sfx/<id>.*         shared SFX library (impact, rumble, riser, whoosh, drill…)
//   public/brand/logo.(png|svg)     optional logo replacing the drawn wordmark
//   public/projects/<slug>/voiceover/<cut>/<scene-id>.(mp3|wav…)  + optional .srt
//   public/projects/<slug>/footage/<file>   photos and clips named in assets.json
//   public/projects/<slug>/music/*          music for this film
//   public/projects/<slug>/sfx/<id>.*       overrides brand SFX for this film
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  AUDIO_EXT, IMAGE_EXT, PUBLIC, ROOT, VIDEO_EXT,
  detectSilences, listFiles, listProjects, loadProject, parseSrt, probeDuration, probeVideo,
} from "./lib.mjs";

const rel = (abs) => path.relative(PUBLIC, abs).split(path.sep).join("/");

const audioDir = (absDir) => {
  const out = {};
  for (const f of listFiles(absDir, AUDIO_EXT)) {
    const abs = path.join(absDir, f);
    out[path.basename(f, path.extname(f)).toLowerCase()] = { file: rel(abs), duration: probeDuration(abs) };
  }
  return out;
};

// Footage Chrome can't decode reliably (HEVC, ProRes, .mov…) is converted
// to H.264 once and cached in footage/.converted/.
const playable = (abs) => {
  const ext = path.extname(abs).toLowerCase();
  const { codec } = probeVideo(abs);
  if ((ext === ".mp4" || ext === ".m4v") && codec === "h264") return abs;
  if (ext === ".webm" && (codec === "vp8" || codec === "vp9")) return abs;
  const out = path.join(path.dirname(abs), ".converted", `${path.basename(abs, ext)}.mp4`);
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(abs).mtimeMs) {
    console.log(`  converting ${rel(abs)} (${codec}) → H.264`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", abs, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  }
  return out;
};

const manifest = { generatedAt: new Date().toISOString(), brand: { music: {}, sfx: {}, logo: null }, projects: {} };
manifest.brand.music = audioDir(path.join(PUBLIC, "brand/music"));
manifest.brand.sfx = audioDir(path.join(PUBLIC, "brand/sfx"));
const logo = listFiles(path.join(PUBLIC, "brand"), [...IMAGE_EXT, ".svg"]).find((f) => f.toLowerCase().startsWith("logo"));
if (logo) manifest.brand.logo = `brand/${logo}`;

for (const slug of listProjects()) {
  const { cuts } = loadProject(slug);
  const base = path.join(PUBLIC, "projects", slug);
  const pm = { voiceover: {}, footage: {}, music: audioDir(path.join(base, "music")), sfx: audioDir(path.join(base, "sfx")) };
  // Music is keyed by file name so cuts can pick a track.
  pm.music = Object.fromEntries(Object.values(pm.music).map((m) => [path.basename(m.file), m]));

  for (const cut of cuts) {
    const dir = path.join(base, "voiceover", cut.id);
    const ids = new Set(cut.scenes.map((s) => s.id));
    pm.voiceover[cut.id] = {};
    for (const f of listFiles(dir, AUDIO_EXT)) {
      const id = path.basename(f, path.extname(f));
      if (!ids.has(id)) {
        console.warn(`! ${rel(path.join(dir, f))}: no scene "${id}" in ${cut.id} cut`);
        continue;
      }
      const abs = path.join(dir, f);
      const entry = { file: rel(abs), duration: probeDuration(abs), silences: detectSilences(abs) };
      const srt = path.join(dir, `${id}.srt`);
      if (fs.existsSync(srt)) entry.srt = parseSrt(srt);
      pm.voiceover[cut.id][id] = entry;
    }
  }

  const footDir = path.join(base, "footage");
  for (const f of listFiles(footDir, [...IMAGE_EXT, ...VIDEO_EXT])) {
    const abs = path.join(footDir, f);
    const isVideo = VIDEO_EXT.includes(path.extname(f).toLowerCase());
    const use = isVideo ? playable(abs) : abs;
    const { width, height } = probeVideo(use);
    pm.footage[f] = isVideo
      ? { file: rel(use), type: "video", duration: probeDuration(use), width, height }
      : { file: rel(use), type: "image", width, height };
  }
  manifest.projects[slug] = pm;

  console.log(`\n${slug}`);
  for (const cut of cuts) {
    const narrated = cut.scenes.filter((s) => s.narration?.length);
    const have = narrated.filter((s) => pm.voiceover[cut.id][s.id]).length;
    console.log(`  ${cut.id.padEnd(6)} voiceover ${have}/${narrated.length} scenes`);
  }
  console.log(`  footage ${Object.keys(pm.footage).length} files · music ${Object.keys(pm.music).length} · sfx ${Object.keys(pm.sfx).length}`);
}
console.log(`\nbrand  music ${Object.keys(manifest.brand.music).length} · sfx ${Object.keys(manifest.brand.sfx).join(", ") || "none"} · logo ${manifest.brand.logo ?? "built-in wordmark"}`);

fs.mkdirSync(path.join(ROOT, "src/generated"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "src/generated/media-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
