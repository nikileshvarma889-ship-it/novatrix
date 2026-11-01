// Voiceover (Piper, optional), royalty-free mood beds and SFX — all generated locally.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { STORAGE_DIR } from "../src/lib/storage";
import { elevenKeyFor, resolveVoice, speak, voiceDefaultsFor } from "../src/lib/elevenlabs";

export const ffprobeDuration = (f: string) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());

export const piperAvailable = () => Boolean(process.env.PIPER_PYTHON && process.env.PIPER_MODEL && fs.existsSync(process.env.PIPER_MODEL));

export const VOICES: Record<string, { speaker: number; label: string }> = {
  "warm-male": { speaker: 198, label: "Warm male (LibriTTS 7134)" },
  "bright-female": { speaker: 100, label: "Bright female (LibriTTS 114)" },
  "calm-female": { speaker: 285, label: "Calm female (LibriTTS 6099)" },
  "neutral-male": { speaker: 54, label: "Neutral male (LibriTTS 4586)" },
};

/**
 * Synthesise one clip per scene; returns per-scene file + duration (null where no text).
 * voice: "elevenlabs" (workspace default, e.g. Bunty/Telugu), "elevenlabs:<voiceId>", or a Piper preset.
 */
export async function synthScenes(dir: string, texts: string[], voice: string, workspaceId: string) {
  fs.mkdirSync(dir, { recursive: true });
  if (voice.startsWith("elevenlabs")) {
    const key = await elevenKeyFor(workspaceId);
    if (!key) throw new Error("ElevenLabs voice selected but no ElevenLabs API key is configured (Settings → Voice).");
    const d = await voiceDefaultsFor(workspaceId);
    const wanted = voice.includes(":") ? voice.split(":")[1] : d.voice;
    if (!wanted) throw new Error("No default ElevenLabs voice is set (Settings → Voice).");
    const v = await resolveVoice(key, wanted, d.language || undefined);
    const out: ({ file: string; duration: number } | null)[] = [];
    for (let i = 0; i < texts.length; i++) {
      if (!texts[i].trim()) {
        out.push(null);
        continue;
      }
      const f = path.join(dir, `vo-${i}.mp3`);
      fs.writeFileSync(f, await speak(key, v.voice_id, texts[i], { model: d.model, language: d.language || undefined }));
      out.push({ file: f, duration: ffprobeDuration(f) });
    }
    return out;
  }
  if (!piperAvailable()) return texts.map(() => null);
  const v = VOICES[voice] ?? VOICES["warm-male"];
  const jobs = texts.map((text, i) => ({ out: path.join(dir, `vo-${i}.wav`), text })).filter((j) => j.text.trim());
  if (!jobs.length) return texts.map(() => null);
  const r = spawnSync(process.env.PIPER_PYTHON!, [path.join(process.cwd(), "tools/tts.py")], {
    input: JSON.stringify({ model: process.env.PIPER_MODEL, speaker: v.speaker, pace: 1.08, jobs }),
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  if (r.status !== 0) throw new Error(`Voiceover synthesis failed: ${r.stderr.slice(-500)}`);
  return texts.map((t, i) => {
    const f = path.join(dir, `vo-${i}.wav`);
    return t.trim() && fs.existsSync(f) ? { file: f, duration: ffprobeDuration(f) } : null;
  });
}

/** Place clips at absolute offsets (seconds) into one track. */
export function mixVoiceover(out: string, clips: { file: string; at: number }[], total: number) {
  const inputs = clips.flatMap((c) => ["-i", c.file]);
  const delays = clips.map((c, i) => `[${i}]adelay=${Math.round(c.at * 1000)}|${Math.round(c.at * 1000)},aresample=48000[a${i}]`).join(";");
  const mix = `${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:normalize=0,apad,atrim=0:${total.toFixed(2)},loudnorm=I=-16:TP=-1.5[out]`;
  execFileSync("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", `${delays};${mix}`, "-map", "[out]", "-ac", "2", out]);
}

const PROGRESSIONS: Record<string, number[][]> = {
  upbeat: [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]],
  inspiring: [[261.6, 329.6, 392], [196, 246.9, 293.7], [220, 261.6, 329.6], [174.6, 220, 261.6]],
  calm: [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]],
  dramatic: [[146.8, 174.6, 220], [116.5, 146.8, 174.6], [174.6, 220, 261.6], [130.8, 164.8, 196]],
  corporate: [[261.6, 329.6, 392], [174.6, 220, 261.6], [220, 261.6, 329.6], [196, 246.9, 293.7]],
};

/** A 32-second original synth bed per mood, generated once and cached. */
export function moodBed(mood: string) {
  const dir = path.join(STORAGE_DIR, "_system");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `bed-${mood}.m4a`);
  if (fs.existsSync(out)) return out;
  const prog = PROGRESSIONS[mood] ?? PROGRESSIONS.corporate;
  const pick = (n: number) => prog.map((c, i) => `if(eq(floor(mod(t,16)/4),${i}),${c[n]},`).join("") + "0" + ")".repeat(prog.length);
  const pulse = mood === "calm" ? "1" : mood === "dramatic" ? "(0.6+0.4*pow(1-mod(t,1)/1,2))" : "(0.55+0.45*pow(1-mod(t,0.5)/0.5,3))";
  const voices = [0, 1, 2].map((n) => `0.1*sin(2*PI*${pick(n)}*t)`).join("+");
  const bass = `0.16*sin(2*PI*${pick(0)}/2*t)*${pulse}`;
  const expr = `(${voices})*${pulse}+${bass}`;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `aevalsrc=exprs='${expr}|${expr}':s=44100:d=32`, "-af", "lowpass=f=3500,aecho=0.8:0.6:300:0.25,afade=t=in:d=1,afade=t=out:st=31:d=1,volume=1.5", "-c:a", "aac", "-b:a", "160k", out]);
  return out;
}

export function whoosh() {
  const out = path.join(STORAGE_DIR, "_system", "whoosh.wav");
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anoisesrc=d=0.7:c=pink:a=0.7", "-af", "bandpass=f=1200:w=1.4,afade=t=in:d=0.3:curve=qsin,afade=t=out:st=0.3:d=0.4:curve=qsin", out]);
  return out;
}
