// Turns a cut's scenes + discovered media into frame-accurate scene lengths
// and subtitle cues. With a voiceover file, a scene's length follows the audio
// and sentence boundaries snap to pauses FFmpeg detected in the recording.
// Without one, timing is estimated from the length of the narration text.
import { TIMING, VIDEO } from "../config";
import { Cut, Line, Project, Scene, TransitionId } from "./types";
import { AudioFile, projectMedia, Silence } from "./media";

export type Cue = { from: number; to: number; text: string };
export type Span = { from: number; to: number };

export type SceneTiming = {
  scene: Scene;
  index: number;
  durationInFrames: number;
  /** Frame (relative to the scene) where narration audio starts. */
  voFrom: number;
  voFrames: number;
  voiceover: string | null;
  sentences: Span[];
  cues: Cue[];
  /** Frames of the transition into the next scene (0 = hard cut). */
  transitionFrames: number;
};

export type CutTiming = {
  scenes: SceneTiming[];
  starts: number[];
  totalFrames: number;
  narrationRanges: Span[];
};

const fps = VIDEO.fps;
const sec = (s: number) => Math.round(s * fps);

export const TRANSITION_FRAMES: Record<TransitionId, number> = {
  cut: 0,
  fade: 15,
  "slide-up": 20,
  "dip-to-black": 30,
  "slow-dissolve": 36,
};

const subOf = (l: Line) => l.sub ?? l.say;

/** Splits a subtitle into readable chunks, preferring clause breaks. */
export function chunkSubtitle(text: string, max = TIMING.maxWordsPerCue): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return [text];
  const clauses = text.split(/(?<=[,:;—])\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) chunks.push(current.join(" "));
    current = [];
  };
  for (const clause of clauses) {
    const cw = clause.split(/\s+/).filter(Boolean);
    if (current.length + cw.length <= max) {
      current.push(...cw);
      continue;
    }
    flush();
    if (cw.length <= max) current.push(...cw);
    else {
      const parts = Math.ceil(cw.length / max);
      const size = Math.ceil(cw.length / parts);
      for (let i = 0; i < cw.length; i += size) chunks.push(cw.slice(i, i + size).join(" "));
    }
  }
  flush();
  return chunks;
}

/** Sentence spans in seconds, relative to the start of the narration audio. */
function sentenceSpans(lines: Line[], speechStart: number, speechEnd: number, silences: Silence[], cps: number) {
  const pause = TIMING.sentencePauseSeconds * cps;
  const weights = lines.map((l) => Math.max(1, l.say.length));
  const total = weights.reduce((a, b) => a + b, 0) + pause * (lines.length - 1);
  const span = speechEnd - speechStart;

  const spans: { start: number; end: number }[] = [];
  let cursor = speechStart;
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    acc += weights[i];
    let end = speechStart + (acc / total) * span;
    let nextStart = end + (pause / total) * span;
    if (i < lines.length - 1 && silences.length) {
      // Snap the boundary to the closest detected pause in the recording.
      const window = Math.max(0.8, ((weights[i] + weights[i + 1]) / total) * span * 0.35);
      let best: Silence | null = null;
      let bestDist = Infinity;
      for (const s of silences) {
        if (s.start <= cursor + 0.2 || s.end >= speechEnd) continue;
        const d = Math.abs((s.start + s.end) / 2 - (end + nextStart) / 2);
        if (d < window && d < bestDist) {
          best = s;
          bestDist = d;
        }
      }
      if (best) {
        end = best.start;
        nextStart = best.end;
      }
    }
    if (i === lines.length - 1) end = speechEnd;
    spans.push({ start: cursor, end });
    acc += pause;
    cursor = nextStart;
  }
  return spans;
}

function buildScene(scene: Scene, index: number, vo: AudioFile | undefined, cps: number, isLast: boolean): SceneTiming {
  const lines = scene.narration ?? [];
  const hasNarration = lines.length > 0;
  const voFrom = sec(scene.leadIn ?? (hasNarration ? TIMING.defaultLeadIn : 0));
  const transitionFrames = isLast ? 0 : TRANSITION_FRAMES[scene.transition ?? "fade"];

  let audioDuration = 0;
  let speechStart = 0;
  let speechEnd = 0;
  let silences: Silence[] = [];
  if (vo) {
    audioDuration = vo.duration;
    silences = vo.silences ?? [];
    speechEnd = audioDuration;
    const lead = silences.find((s) => s.start <= 0.05);
    if (lead) speechStart = Math.min(lead.end, audioDuration);
    const trail = silences.find((s) => s.end >= audioDuration - 0.05 && s.start > speechStart);
    if (trail) speechEnd = trail.start;
  } else if (hasNarration) {
    const chars = lines.reduce((a, l) => a + l.say.length, 0);
    audioDuration = chars / cps + TIMING.sentencePauseSeconds * (lines.length - 1);
    speechEnd = audioDuration;
  }

  const spans = hasNarration ? sentenceSpans(lines, speechStart, speechEnd, silences, cps) : [];
  const toFrame = (s: number) => voFrom + Math.round(s * fps);

  const cues: Cue[] = [];
  if (vo?.srt?.length) {
    for (const c of vo.srt) cues.push({ from: toFrame(c.start), to: toFrame(c.end), text: c.text });
  } else {
    spans.forEach((span, i) => {
      const chunks = chunkSubtitle(subOf(lines[i]));
      const chars = chunks.reduce((a, c) => a + c.length, 0);
      let t = span.start;
      for (const chunk of chunks) {
        const d = ((span.end - span.start) * chunk.length) / chars;
        cues.push({ from: toFrame(t), to: toFrame(t + d), text: chunk });
        t += d;
      }
    });
  }

  const voFrames = Math.ceil(audioDuration * fps);
  const tail = sec(scene.tail ?? (hasNarration ? TIMING.defaultTail : 0));
  // Every scene is at least long enough to cover its transitions.
  const min = Math.max(sec(scene.minSeconds ?? 0), transitionFrames + 30);
  return {
    scene,
    index,
    durationInFrames: Math.max(min, voFrom + voFrames + tail + transitionFrames),
    voFrom,
    voFrames,
    voiceover: vo ? vo.file : null,
    sentences: spans.map((s) => ({ from: toFrame(s.start), to: toFrame(s.end) })),
    cues,
    transitionFrames,
  };
}

export function buildCut(project: Project, cut: Cut): CutTiming {
  const media = projectMedia(project.slug).voiceover[cut.id] ?? {};
  const cps = TIMING.charsPerSecond[project.narrationLanguage] ?? TIMING.charsPerSecond.default;
  const scenes = cut.scenes.map((s, i) => buildScene(s, i, media[s.id], cps, i === cut.scenes.length - 1));

  const starts: number[] = [];
  scenes.forEach((s, i) => {
    starts.push(i === 0 ? 0 : starts[i - 1] + scenes[i - 1].durationInFrames - scenes[i - 1].transitionFrames);
  });
  const last = scenes.length - 1;
  const totalFrames = last < 0 ? 1 : starts[last] + scenes[last].durationInFrames;

  const narrationRanges = scenes
    .map((s, i) =>
      s.sentences.length
        ? { from: starts[i] + s.sentences[0].from, to: starts[i] + s.sentences[s.sentences.length - 1].to }
        : null,
    )
    .filter((r): r is Span => r !== null);

  return { scenes, starts, totalFrames, narrationRanges };
}
