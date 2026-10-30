#!/usr/bin/env node
// Generates natural AI narration with a Piper neural voice (runs on CPU).
// Writes public/projects/<slug>/voiceover/<cut>/<scene>.wav, never
// overwriting real recordings. Remove generated files with --clean.
//
// One-time setup (see docs/PRODUCTION.md):
//   python3 -m venv ~/untold-tts && ~/untold-tts/bin/pip install piper-tts
//   curl -L https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-libritts-high.tar.gz | tar xz -C ~/untold-voice
// Usage:
//   UNTOLD_TTS_PYTHON=~/untold-tts/bin/python UNTOLD_TTS_MODEL=~/untold-voice/en-us-libritts-high.onnx \
//     npm run ai-voiceover -- <slug> [--speaker 198] [--pace 1.25] [--clean]
//
// The default voice (LibriTTS speaker 7134, id 198) is CC BY 4.0: credit it
// via "voiceCredit" in project.json (printed into the YouTube description).
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC, ROOT, loadProject } from "./lib.mjs";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const speaker = parseInt(opt("--speaker", "198"), 10);
const pace = parseFloat(opt("--pace", "1.25"));
if (!slug) {
  console.error("Usage: npm run ai-voiceover -- <slug> [--speaker 198] [--pace 1.25] [--clean]");
  process.exit(1);
}
const { cuts } = loadProject(slug);
const base = path.join(PUBLIC, "projects", slug, "voiceover");
const marker = path.join(base, ".ai-voice.json");
const generated = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, "utf8")) : [];

if (args.includes("--clean")) {
  for (const f of generated) fs.rmSync(path.join(base, f), { force: true });
  fs.rmSync(marker, { force: true });
  console.log(`Removed ${generated.length} AI narration files.`);
  process.exit(0);
}

const python = process.env.UNTOLD_TTS_PYTHON;
const model = process.env.UNTOLD_TTS_MODEL;
if (!python || !model || !fs.existsSync(model)) {
  console.error("Set UNTOLD_TTS_PYTHON (python with piper-tts) and UNTOLD_TTS_MODEL (path to the voice .onnx).");
  process.exit(1);
}

// Other generated narration (scratch) is replaced; real recordings are kept.
const scratchMarker = path.join(base, ".scratch.json");
const scratch = fs.existsSync(scratchMarker) ? JSON.parse(fs.readFileSync(scratchMarker, "utf8")) : [];
const replaceable = new Set([...generated, ...scratch]);

const jobs = [];
const written = new Set(generated);
const tmp = path.join(base, ".ai-tmp");
fs.mkdirSync(tmp, { recursive: true });
for (const cut of cuts) {
  const dir = path.join(base, cut.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const s of cut.scenes) {
    if (!s.narration?.length) continue;
    const existing = fs.readdirSync(dir).filter((f) => f.startsWith(`${s.id}.`) && !f.endsWith(".srt"));
    if (existing.some((f) => !replaceable.has(`${cut.id}/${f}`))) {
      console.log(`  keeping your recording for ${cut.id}/${s.id}`);
      continue;
    }
    for (const f of existing) fs.rmSync(path.join(dir, f));
    jobs.push({ out: path.join(tmp, `${cut.id}--${s.id}.wav`), final: path.join(dir, `${s.id}.wav`), rel: `${cut.id}/${s.id}.wav`, lines: s.narration.map((l) => l.say) });
  }
}

const r = spawnSync(python, [path.join(ROOT, "tools/tts/piper_tts.py")], {
  input: JSON.stringify({ model, speaker, length_scale: pace, pause: 0.45, jobs: jobs.map(({ out, lines }) => ({ out, lines })) }),
  stdio: ["pipe", "inherit", "inherit"],
  maxBuffer: 1 << 26,
});
if (r.status !== 0) process.exit(r.status ?? 1);

// Pad, normalise to broadcast loudness and gently de-ess/warm the voice.
for (const j of jobs) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", j.out, "-af", "adelay=150|150,apad=pad_dur=0.25,highpass=f=70,equalizer=f=6500:t=q:w=2:g=-2,loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "1", j.final]);
  written.add(j.rel);
}
fs.rmSync(tmp, { recursive: true, force: true });
if (scratch.length) {
  const left = scratch.filter((f) => fs.existsSync(path.join(base, f)) && !written.has(f));
  left.length ? fs.writeFileSync(scratchMarker, JSON.stringify(left, null, 2)) : fs.rmSync(scratchMarker, { force: true });
}
fs.writeFileSync(marker, JSON.stringify([...written], null, 2));
console.log(`AI narration (speaker ${speaker}, pace ${pace}) written for ${jobs.length} scenes.`);
