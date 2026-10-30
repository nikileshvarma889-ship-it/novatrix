#!/usr/bin/env node
// Generates a royalty-free ambient synth loop with FFmpeg so the music track
// can be tested before you add your own. Output: public/music/placeholder-ambient.mp3
// Delete it once you drop your real track into public/music/.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public/music/placeholder-ambient.mp3");

// Am - F - C - G, 4 seconds per chord, 16-second loop.
const chords = [
  [110, 220, 261.63, 329.63],
  [87.31, 174.61, 220, 261.63],
  [130.81, 261.63, 329.63, 392],
  [98, 196, 246.94, 293.66],
];
const pick = (n) =>
  chords
    .map((c, i) => `if(eq(floor(mod(t,16)/4),${i}),${c[n]},`)
    .join("") + "0" + ")".repeat(chords.length);

const pad = [1, 2, 3]
  .map((n) => `0.11*sin(2*PI*${pick(n)}*t)*(0.75+0.25*sin(2*PI*0.25*t+${n}))`)
  .join("+");
const bass = `0.22*sin(2*PI*${pick(0)}*t)*pow(1-mod(t,0.5)/0.5,3)`;
const arp = `0.05*sin(2*PI*2*${pick(1 + 0)}*pow(2,floor(mod(t*4,4))/4)*t)*pow(1-mod(t,0.25)/0.25,4)`;
const expr = `${pad}+${bass}+${arp}`;

execFileSync(
  "ffmpeg",
  [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", `aevalsrc=exprs='${expr}|${expr}':s=44100:d=64`,
    "-af", "lowpass=f=4200,aecho=0.8:0.7:180|360:0.25|0.15,volume=1.6,afade=t=in:d=0.5,afade=t=out:st=63:d=1",
    "-c:a", "libmp3lame", "-b:a", "160k",
    out,
  ],
  { stdio: "inherit" },
);
console.log(`Wrote ${path.relative(root, out)}`);
