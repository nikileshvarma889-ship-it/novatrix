#!/usr/bin/env node
// Optional: builds a robotic "scratch" voiceover with espeak-ng so you can
// check pacing and subtitle sync before recording the real narration.
// Writes public/voiceover/<segment>.wav, but never overwrites your own files.
// Remove them with: npm run scratch-voiceover -- --clean
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public/voiceover");
const marker = path.join(dir, ".scratch.json");
const narration = JSON.parse(fs.readFileSync(path.join(root, "src/content/narration.json"), "utf8"));
const scratch = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, "utf8")) : [];

if (process.argv.includes("--clean")) {
  for (const f of scratch) fs.rmSync(path.join(dir, f), { force: true });
  fs.rmSync(marker, { force: true });
  console.log(`Removed ${scratch.length} scratch voiceover files.`);
  process.exit(0);
}

if (spawnSync("espeak-ng", ["--version"]).status !== 0) {
  console.error("espeak-ng is not installed (e.g. `sudo apt install espeak-ng` or `brew install espeak-ng`).");
  process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });
const existing = fs.readdirSync(dir);
const written = new Set(scratch);
for (const [id, sentences] of Object.entries(narration)) {
  const mine = existing.find((f) => f.toLowerCase().replace(/^\d+[-_ ]*/, "").startsWith(id) && !scratch.includes(f));
  if (mine) {
    console.log(`  ${id}: keeping your file ${mine}`);
    continue;
  }
  const file = `${id}.wav`;
  const raw = path.join(dir, `.${id}.raw.wav`);
  execFileSync("espeak-ng", ["-v", "en-us+m3", "-s", "160", "-g", "8", "-w", raw, sentences.join(" ")]);
  // Pad 0.2s of silence at both ends and normalise loudness.
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", "adelay=200|200,apad=pad_dur=0.2,loudnorm=I=-16:TP=-1.5", "-ar", "44100", path.join(dir, file)]);
  fs.rmSync(raw);
  written.add(file);
  console.log(`  ${id}: wrote ${file}`);
}
fs.writeFileSync(marker, JSON.stringify([...written], null, 2));
