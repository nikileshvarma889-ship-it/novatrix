#!/usr/bin/env node
// Builds a robotic "scratch" narration with espeak-ng, in the project's
// narration language, to check pacing and subtitle sync before the real
// voice is recorded. It is NOT for publishing.
// Never overwrites real recordings; remove with --clean.
// Usage: node tools/scratch-voiceover.mjs <slug> [--clean]
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC, loadProject } from "./lib.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: npm run scratch-voiceover -- <slug> [--clean]");
  process.exit(1);
}
const { project, cuts } = loadProject(slug);
const base = path.join(PUBLIC, "projects", slug, "voiceover");
const marker = path.join(base, ".scratch.json");
const scratch = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, "utf8")) : [];

if (process.argv.includes("--clean")) {
  for (const f of scratch) fs.rmSync(path.join(base, f), { force: true });
  fs.rmSync(marker, { force: true });
  console.log(`Removed ${scratch.length} scratch narration files.`);
  process.exit(0);
}
if (spawnSync("espeak-ng", ["--version"]).status !== 0) {
  console.error("espeak-ng is not installed (apt install espeak-ng / brew install espeak-ng).");
  process.exit(1);
}

const written = new Set(scratch);
for (const cut of cuts) {
  const dir = path.join(base, cut.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const s of cut.scenes) {
    if (!s.narration?.length) continue;
    const file = `${s.id}.wav`;
    const relFile = `${cut.id}/${file}`;
    const own = fs.readdirSync(dir).find((f) => f.startsWith(`${s.id}.`) && !scratch.includes(`${cut.id}/${f}`));
    if (own) continue;
    const raw = path.join(dir, `.${s.id}.raw.wav`);
    // Sentences separated by a short pause so pause detection has something to find.
    const text = s.narration.map((l) => l.say).join(" ... ");
    execFileSync("espeak-ng", ["-v", project.narrationLanguage, "-s", "140", "-w", raw, text]);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", "adelay=150|150,apad=pad_dur=0.2,loudnorm=I=-16:TP=-1.5", "-ar", "44100", path.join(dir, file)]);
    fs.rmSync(raw);
    written.add(relFile);
  }
}
fs.writeFileSync(marker, JSON.stringify([...written], null, 2));
console.log(`Scratch narration (${project.narrationLanguage}) written for ${written.size} scenes in public/projects/${slug}/voiceover/.`);
