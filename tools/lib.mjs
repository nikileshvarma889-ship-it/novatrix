// Shared helpers for the production tools.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC = path.join(ROOT, "public");
export const PROJECTS_SRC = path.join(ROOT, "src/projects");

export const AUDIO_EXT = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"];
export const VIDEO_EXT = [".mp4", ".webm", ".mov", ".mkv", ".m4v"];
export const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];

export const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/** All project slugs that have a project.json. */
export const listProjects = () =>
  fs
    .readdirSync(PROJECTS_SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(PROJECTS_SRC, d.name, "project.json")))
    .map((d) => d.name)
    .sort();

export const loadProject = (slug) => {
  const dir = path.join(PROJECTS_SRC, slug);
  const cuts = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !["project.json", "assets.json", "facts.json"].includes(f))
    .map((f) => readJson(path.join(dir, f)));
  return {
    project: readJson(path.join(dir, "project.json")),
    assets: readJson(path.join(dir, "assets.json")),
    facts: readJson(path.join(dir, "facts.json")),
    cuts,
  };
};

export const listFiles = (absDir, exts) =>
  fs.existsSync(absDir)
    ? fs
        .readdirSync(absDir)
        .filter((f) => !f.startsWith(".") && exts.includes(path.extname(f).toLowerCase()))
        .sort()
    : [];

const ffprobe = (abs, args) => execFileSync("ffprobe", ["-v", "error", ...args, abs], { encoding: "utf8" }).trim();

export const probeDuration = (abs) => {
  const d = parseFloat(ffprobe(abs, ["-show_entries", "format=duration", "-of", "default=nw=1:nk=1"]));
  if (!Number.isFinite(d)) throw new Error(`Could not read duration of ${abs}`);
  return Math.round(d * 1000) / 1000;
};

export const probeVideo = (abs) => {
  const [codec, w, h] = ffprobe(abs, ["-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "csv=p=0"]).split(",");
  return { codec, width: parseInt(w, 10), height: parseInt(h, 10) };
};

/** Pauses in a narration recording, used to align subtitles. */
export const detectSilences = (abs) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", abs, "-af", "silencedetect=noise=-35dB:d=0.18", "-f", "null", "-"], {
    encoding: "utf8",
  });
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
  if (start !== null) out.push({ start, end: probeDuration(abs) });
  return out;
};

export const parseSrt = (abs) => {
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

export const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
