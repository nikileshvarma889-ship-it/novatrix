#!/usr/bin/env node
// Generates a dark, slow, copyright-free documentary drone with FFmpeg so the
// music bed can be tested. Output: public/brand/music/placeholder-drone.mp3.
// Replace it with a licensed score for publishing.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC } from "./lib.mjs";

const out = path.join(PUBLIC, "brand/music/placeholder-drone.mp3");
fs.mkdirSync(path.dirname(out), { recursive: true });

// D minor, 8 s per chord, 32-second loop: Dm – Bb – F – C (low, sustained).
const chords = [
  [73.42, 146.83, 174.61, 220],
  [58.27, 116.54, 146.83, 174.61],
  [87.31, 130.81, 174.61, 220],
  [65.41, 130.81, 164.81, 196],
];
const pick = (n) => chords.map((c, i) => `if(eq(floor(mod(t,32)/8),${i}),${c[n]},`).join("") + "0" + ")".repeat(chords.length);
// Each voice swells slowly; the bass breathes on a 16 s cycle.
const voices = [1, 2, 3].map((n) => `0.09*sin(2*PI*${pick(n)}*t)*(0.6+0.4*sin(2*PI*t/${11 + n * 3}+${n}))`).join("+");
const bass = `0.2*sin(2*PI*${pick(0)}*t)*(0.7+0.3*sin(2*PI*t/16))`;
const expr = `${voices}+${bass}`;

execFileSync(
  "ffmpeg",
  [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", `aevalsrc=exprs='${expr}|${expr}':s=44100:d=96`,
    "-f", "lavfi", "-i", "anoisesrc=d=96:c=brown:a=0.04",
    "-filter_complex", "[1]lowpass=f=400[air];[0][air]amix=inputs=2:weights='1 0.5',lowpass=f=2400,aecho=0.8:0.8:400|900:0.35|0.25,volume=2.2,afade=t=in:d=2,afade=t=out:st=93:d=3",
    "-c:a", "libmp3lame", "-b:a", "192k", out,
  ],
  { stdio: "inherit" },
);
console.log(`Wrote ${path.relative(PUBLIC, out)}`);
