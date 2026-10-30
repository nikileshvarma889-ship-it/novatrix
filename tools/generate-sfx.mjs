#!/usr/bin/env node
// Synthesizes a small, copyright-free documentary SFX library with FFmpeg
// into public/brand/sfx/. Replace any file with a licensed sound of the same
// name (e.g. impact.wav) for a richer mix.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PUBLIC } from "./lib.mjs";

const dir = path.join(PUBLIC, "brand/sfx");
fs.mkdirSync(dir, { recursive: true });

const make = (name, args) => {
  const out = path.join(dir, `${name}.wav`);
  execFileSync("ffmpeg", ["-y", "-v", "error", ...args, "-ar", "48000", "-ac", "2", out]);
  console.log(`  ${path.relative(PUBLIC, out)}`);
};

// Deep cinematic hit: sub-bass drop + filtered noise burst + long tail.
make("impact", [
  "-f", "lavfi", "-i", "aevalsrc=exprs='0.9*sin(2*PI*(38+70*exp(-t*9))*t)*exp(-t*1.6)':s=48000:d=4",
  "-f", "lavfi", "-i", "anoisesrc=d=4:c=brown:a=0.6",
  "-filter_complex", "[1]lowpass=f=900,afade=t=out:st=0:d=0.6[n];[0][n]amix=inputs=2:weights='1 0.6',aecho=0.8:0.6:120|260:0.3|0.2,afade=t=out:st=2.5:d=1.5,volume=1.6",
]);
// Low rolling rumble of moving rock.
make("rumble", [
  "-f", "lavfi", "-i", "anoisesrc=d=6:c=brown:a=0.9",
  "-af", "lowpass=f=160,tremolo=f=3:d=0.6,afade=t=in:d=1.2,afade=t=out:st=4:d=2,volume=1.6,alimiter=limit=0.7",
]);
// Rising tension swell.
make("riser", [
  "-f", "lavfi", "-i", "aevalsrc=exprs='0.25*sin(2*PI*(80+t*t*18)*t)+0.12*sin(2*PI*(121+t*t*27)*t)':s=48000:d=3",
  "-f", "lavfi", "-i", "anoisesrc=d=3:c=pink:a=0.3",
  "-filter_complex", "[1]highpass=f=1500,lowpass=f=6000[n];[0][n]amix=inputs=2,afade=t=in:d=2.6:curve=exp,afade=t=out:st=2.8:d=0.2,volume=1.6",
]);
// Soft air whoosh for chapter cards.
make("whoosh", [
  "-f", "lavfi", "-i", "anoisesrc=d=1.4:c=pink:a=0.8",
  "-af", "bandpass=f=900:w=1.2,afade=t=in:d=0.6:curve=qsin,afade=t=out:st=0.6:d=0.8:curve=qsin,volume=1.4",
]);
// Distant drilling bed.
make("drill", [
  "-f", "lavfi", "-i", "aevalsrc=exprs='0.4*sin(2*PI*55*t)*(0.6+0.4*sin(2*PI*14*t))':s=48000:d=6",
  "-f", "lavfi", "-i", "anoisesrc=d=6:c=brown:a=0.5",
  "-filter_complex", "[1]bandpass=f=300:w=1[n];[0][n]amix=inputs=2,lowpass=f=1200,afade=t=in:d=1,afade=t=out:st=4.5:d=1.5,volume=1.4",
]);
