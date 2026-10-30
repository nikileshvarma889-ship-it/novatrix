#!/usr/bin/env node
// Scans public/ for your voiceover, music, screen recordings, SFX and logo,
// measures them with FFprobe, detects pauses in narration with FFmpeg, and
// writes src/generated/media-manifest.json for the video to use.
//
//   public/voiceover/<segment>.(mp3|wav|m4a|aac|ogg)  + optional <segment>.srt
//   public/music/<anything>.(mp3|wav|m4a|ogg)        first file alphabetically
//   public/clips/<tool>.(mp4|webm|mov|mkv|m4v)        screen recordings
//   public/sfx/whoosh.(mp3|wav)                       transition sound
//   public/brand/logo.(png|svg|webp|jpg)              replaces the drawn emblem
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const narration = JSON.parse(fs.readFileSync(path.join(root, "src/content/narration.json"), "utf8"));
const segments = Object.keys(narration);

const AUDIO = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"];
const VIDEO = [".mp4", ".webm", ".mov", ".mkv", ".m4v"];
const IMAGE = [".png", ".svg", ".webp", ".jpg", ".jpeg"];

const list = (dir, exts) => {
  const abs = path.join(pub, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => !f.startsWith(".") && exts.includes(path.extname(f).toLowerCase()))
    .sort();
};

// "02-claude.mp3" / "Claude.wav" / "claude_take3.mp3" -> "claude"
const idOf = (file) => {
  const base = path.basename(file, path.extname(file)).toLowerCase().replace(/^\d+[-_ ]*/, "");
  return segments.find((s) => base === s || base.startsWith(`${s}-`) || base.startsWith(`${s}_`)) ?? base;
};

const probe = (rel) => {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path.join(pub, rel)],
    { encoding: "utf8" },
  );
  const d = parseFloat(out.trim());
  if (!Number.isFinite(d)) throw new Error(`Could not read duration of ${rel}`);
  return Math.round(d * 1000) / 1000;
};

const videoCodec = (rel) =>
  execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "default=nw=1:nk=1", path.join(pub, rel)],
    { encoding: "utf8" },
  ).trim();

const silences = (rel) => {
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", path.join(pub, rel), "-af", "silencedetect=noise=-35dB:d=0.18", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const out = [];
  let start = null;
  for (const line of (r.stderr || "").split("\n")) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) start = Math.max(0, parseFloat(s[1]));
    if (e && start !== null) {
      out.push({ start: Math.round(start * 1000) / 1000, end: Math.round(parseFloat(e[1]) * 1000) / 1000 });
      start = null;
    }
  }
  if (start !== null) out.push({ start, end: probe(rel) });
  return out;
};

const parseSrt = (abs) => {
  const t = (s) => {
    const [h, m, rest] = s.trim().split(":");
    return +h * 3600 + +m * 60 + parseFloat(rest.replace(",", "."));
  };
  return fs
    .readFileSync(abs, "utf8")
    .replace(/\r/g, "")
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.trim().split("\n");
      const timeLine = lines.find((l) => l.includes("-->"));
      if (!timeLine) return null;
      const [a, b] = timeLine.split("-->");
      const text = lines.slice(lines.indexOf(timeLine) + 1).join(" ").trim();
      return text ? { start: t(a), end: t(b), text } : null;
    })
    .filter(Boolean);
};

// Screen recordings in formats Chrome can't decode reliably (e.g. HEVC .mov
// from iPhones/Macs) are converted to H.264 MP4 once and cached.
const ensurePlayable = (rel) => {
  const ext = path.extname(rel).toLowerCase();
  const codec = videoCodec(rel);
  if ((ext === ".mp4" || ext === ".m4v") && codec === "h264") return rel;
  if (ext === ".webm" && (codec === "vp8" || codec === "vp9")) return rel;
  const outRel = path.join("clips/.converted", `${path.basename(rel, ext)}.mp4`);
  const outAbs = path.join(pub, outRel);
  const srcAbs = path.join(pub, rel);
  if (!fs.existsSync(outAbs) || fs.statSync(outAbs).mtimeMs < fs.statSync(srcAbs).mtimeMs) {
    console.log(`  converting ${rel} (${codec}) -> ${outRel}`);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", srcAbs, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outAbs]);
  }
  return outRel;
};

const manifest = { generatedAt: new Date().toISOString(), music: null, voiceover: {}, clips: {}, sfx: {}, logo: null };
const report = [];

for (const f of list("voiceover", AUDIO)) {
  const id = idOf(f);
  if (!segments.includes(id)) {
    console.warn(`! voiceover/${f}: unknown segment "${id}". Use one of: ${segments.join(", ")}`);
    continue;
  }
  if (manifest.voiceover[id]) {
    console.warn(`! voiceover/${f}: ignored, already using ${manifest.voiceover[id].file} for "${id}"`);
    continue;
  }
  const rel = `voiceover/${f}`;
  const entry = { file: rel, duration: probe(rel), silences: silences(rel) };
  const srt = path.join(pub, "voiceover", `${path.basename(f, path.extname(f))}.srt`);
  if (fs.existsSync(srt)) entry.srt = parseSrt(srt);
  manifest.voiceover[id] = entry;
}

const music = list("music", AUDIO)[0];
if (music) manifest.music = { file: `music/${music}`, duration: probe(`music/${music}`) };

for (const f of list("clips", VIDEO)) {
  const id = idOf(f);
  const rel = ensurePlayable(`clips/${f}`);
  manifest.clips[id] = { file: rel, duration: probe(rel) };
}

for (const f of list("sfx", AUDIO)) {
  const id = path.basename(f, path.extname(f)).toLowerCase();
  manifest.sfx[id] = { file: `sfx/${f}`, duration: probe(`sfx/${f}`) };
}

const logo = list("brand", IMAGE).find((f) => f.toLowerCase().startsWith("logo"));
if (logo) manifest.logo = `brand/${logo}`;

fs.mkdirSync(path.join(root, "src/generated"), { recursive: true });
fs.writeFileSync(path.join(root, "src/generated/media-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const tools = segments.filter((s) => s !== "intro" && s !== "outro");
for (const s of segments) {
  const vo = manifest.voiceover[s];
  const clip = manifest.clips[s];
  report.push(
    `  ${s.padEnd(11)} voiceover: ${vo ? `${vo.file} (${vo.duration.toFixed(1)}s${vo.srt ? ", srt" : ""})` : "— estimated timing"}` +
      (tools.includes(s) ? `   clip: ${clip ? clip.file : "— placeholder"}` : ""),
  );
}
console.log("NOVATRIX media scan");
console.log(report.join("\n"));
console.log(`  music:      ${manifest.music ? manifest.music.file : "— none (add a file to public/music/)"}`);
console.log(`  sfx:        ${Object.keys(manifest.sfx).join(", ") || "— none"}`);
console.log(`  logo:       ${manifest.logo ?? "— built-in emblem"}`);
