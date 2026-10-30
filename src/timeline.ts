// Turns narration + discovered media into frame-accurate scene lengths and
// subtitle cues. With a voiceover file, scene length follows the audio and
// sentence boundaries snap to pauses FFmpeg detected in the recording.
// Without one, everything is estimated from word count.
import narrationJson from "./content/narration.json";
import { TOOLS, Tool } from "./content/tools";
import { TIMING, VIDEO } from "./config";
import { MEDIA, Silence } from "./media";

const narration = narrationJson as Record<string, string[]>;

export type SegmentKind = "intro" | "tool" | "outro";

export type Cue = { from: number; to: number; text: string };
export type Span = { from: number; to: number };

export type SegmentTiming = {
  id: string;
  kind: SegmentKind;
  tool?: Tool;
  durationInFrames: number;
  /** Frame (relative to the scene) where narration starts. */
  voFrom: number;
  voFrames: number;
  voiceover: string | null;
  clip: { file: string; frames: number } | null;
  sentences: Span[];
  cues: Cue[];
};

type SegmentDef = { id: string; kind: SegmentKind; leadIn: number; tail: number; tool?: Tool };

const SEGMENTS: SegmentDef[] = [
  { id: "intro", kind: "intro", leadIn: 4.6, tail: 0.9 },
  ...TOOLS.map((tool): SegmentDef => ({ id: tool.id, kind: "tool", leadIn: 0.9, tail: 1.0, tool })),
  { id: "outro", kind: "outro", leadIn: 1.0, tail: 7.5 },
];

const fps = VIDEO.fps;
const sec = (s: number) => Math.round(s * fps);
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Splits a sentence into subtitle-sized chunks, preferring comma breaks. */
export function chunkSentence(sentence: string, max = TIMING.maxWordsPerCue): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length <= max) return [sentence];
  const clauses = sentence.split(/(?<=,)\s+/);
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
    if (cw.length <= max) {
      current.push(...cw);
    } else {
      const parts = Math.ceil(cw.length / max);
      const size = Math.ceil(cw.length / parts);
      for (let i = 0; i < cw.length; i += size) chunks.push(cw.slice(i, i + size).join(" "));
    }
  }
  flush();
  return chunks;
}

/** Sentence spans in seconds, relative to the start of the narration audio. */
function sentenceSpans(sentences: string[], speechStart: number, speechEnd: number, silences: Silence[]) {
  const pause = TIMING.sentencePauseSeconds * TIMING.wordsPerSecond;
  const weights = sentences.map((s) => wordCount(s));
  const total = weights.reduce((a, b) => a + b, 0) + pause * (sentences.length - 1);
  const span = speechEnd - speechStart;

  const spans: { start: number; end: number }[] = [];
  let cursor = speechStart;
  let acc = 0;
  for (let i = 0; i < sentences.length; i++) {
    acc += weights[i];
    let end = speechStart + (acc / total) * span;
    let nextStart = end + (pause / total) * span;
    if (i < sentences.length - 1 && silences.length) {
      // Snap the boundary to the closest detected pause in the recording.
      const window = Math.max(0.8, ((weights[i] + weights[i + 1]) / total) * span * 0.35);
      let best: Silence | null = null;
      let bestDist = Infinity;
      for (const s of silences) {
        if (s.start <= cursor + 0.2 || s.end >= speechEnd) continue;
        const mid = (s.start + s.end) / 2;
        const d = Math.abs(mid - (end + nextStart) / 2);
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
    if (i === sentences.length - 1) end = speechEnd;
    spans.push({ start: cursor, end });
    acc += pause;
    cursor = nextStart;
  }
  return spans;
}

function buildSegment(def: SegmentDef): SegmentTiming {
  const sentences = narration[def.id] ?? [];
  const vo = MEDIA.voiceover[def.id];
  const voFrom = sec(def.leadIn);

  let audioDuration: number;
  let speechStart = 0;
  let speechEnd: number;
  let silences: Silence[] = [];

  if (vo) {
    audioDuration = vo.duration;
    silences = vo.silences ?? [];
    speechEnd = audioDuration;
    const lead = silences.find((s) => s.start <= 0.05);
    if (lead) speechStart = Math.min(lead.end, audioDuration);
    const trail = silences.find((s) => s.end >= audioDuration - 0.05 && s.start > speechStart);
    if (trail) speechEnd = trail.start;
  } else {
    const words = sentences.reduce((a, s) => a + wordCount(s), 0);
    audioDuration =
      words / TIMING.wordsPerSecond + TIMING.sentencePauseSeconds * Math.max(0, sentences.length - 1);
    speechEnd = audioDuration;
  }

  const spans = sentenceSpans(sentences, speechStart, speechEnd, silences);
  const toFrame = (s: number) => voFrom + Math.round(s * fps);

  let cues: Cue[] = [];
  if (vo?.srt?.length) {
    cues = vo.srt.map((c) => ({ from: toFrame(c.start), to: toFrame(c.end), text: c.text }));
  } else {
    spans.forEach((span, i) => {
      const chunks = chunkSentence(sentences[i]);
      const chars = chunks.reduce((a, c) => a + c.length, 0);
      let t = span.start;
      chunks.forEach((chunk) => {
        const d = ((span.end - span.start) * chunk.length) / chars;
        cues.push({ from: toFrame(t), to: toFrame(t + d), text: chunk });
        t += d;
      });
    });
  }

  const voFrames = Math.ceil(audioDuration * fps);
  const clip = MEDIA.clips[def.id];
  return {
    id: def.id,
    kind: def.kind,
    tool: def.tool,
    durationInFrames: voFrom + voFrames + sec(def.tail),
    voFrom,
    voFrames,
    voiceover: vo ? vo.file : null,
    clip: clip ? { file: clip.file, frames: Math.max(1, Math.floor(clip.duration * fps)) } : null,
    sentences: spans.map((s) => ({ from: toFrame(s.start), to: toFrame(s.end) })),
    cues,
  };
}

export const TIMELINE: SegmentTiming[] = SEGMENTS.map(buildSegment);

/** Absolute start frame of every segment (transitions overlap neighbours). */
export const SEGMENT_STARTS: number[] = TIMELINE.reduce<number[]>((starts, seg, i) => {
  starts.push(i === 0 ? 0 : starts[i - 1] + TIMELINE[i - 1].durationInFrames - TIMING.transitionFrames);
  return starts;
}, []);

export const TOTAL_FRAMES =
  TIMELINE.reduce((a, s) => a + s.durationInFrames, 0) - TIMING.transitionFrames * (TIMELINE.length - 1);

/** Absolute frame ranges where narration is audible, used for music ducking. */
export const NARRATION_RANGES: Span[] = TIMELINE.map((seg, i) => ({
  from: SEGMENT_STARTS[i] + (seg.sentences[0]?.from ?? seg.voFrom),
  to: SEGMENT_STARTS[i] + (seg.sentences[seg.sentences.length - 1]?.to ?? seg.voFrom + seg.voFrames),
}));
