import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";

// Readable chunks per narration line (2–4 words), in order.
const CHUNKS: string[][] = [
  ["ఒక్కసారి ఊహించుకోండి!"],
  ["మీరు అంతరిక్షంలో ఉన్నారు...", "మీ పక్కనే ఒక భారీ పేలుడు", "జరిగినా మీకు", "శబ్దం వినిపించదు!"],
  ["అవును! ఇది నిజం!"],
  ["ఎందుకంటే శబ్దం", "ప్రయాణించడానికి", "గాలి లేదా మరొక పదార్థం అవసరం."],
  ["కానీ అంతరిక్షంలో", "దాదాపు శూన్య వాతావరణం ఉంటుంది."],
  ["అందుకే అక్కడ శబ్దం", "మన చెవులకు చేరదు!"],
  ["ఇలాంటి అద్భుతమైన విషయాలు తెలుసుకోవడానికి", "మన పేజీని ఫాలో అవ్వండి!"],
];
// Key words shown in golden yellow.
const GOLD = ["అంతరిక్షంలో", "భారీ", "పేలుడు", "శబ్దం", "వినిపించదు", "నిజం", "గాలి", "పదార్థం", "శూన్య", "చెవులకు", "చేరదు", "అద్భుతమైన", "ఫాలో"];

type Cue = { from: number; to: number; text: string };

/** Chunk boundaries: proportional to text length, snapped to the nearest real pause in the voice. */
export function buildCues(): Cue[] {
  const cues: Cue[] = [];
  timeline.lines.forEach((line, i) => {
    const chunks = CHUNKS[i];
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const bounds = [0];
    let acc = 0;
    for (let j = 0; j < chunks.length - 1; j++) {
      acc += chunks[j].length;
      const est = (acc / total) * line.duration;
      const near = line.pauses.reduce<number | null>((best, p) => (Math.abs(p - est) < 0.75 && (best === null || Math.abs(p - est) < Math.abs(best - est)) ? p : best), null);
      bounds.push(Math.max(bounds[bounds.length - 1] + 0.35, near ?? est));
    }
    bounds.push(line.duration + 0.25);
    chunks.forEach((text, j) => cues.push({ from: line.start + bounds[j], to: line.start + bounds[j + 1], text }));
  });
  return cues;
}
const CUES = buildCues();

const Word: React.FC<{ w: string }> = ({ w }) => {
  const gold = GOLD.some((g) => w.replace(/[!.?,…]+/g, "").includes(g));
  return <span style={{ color: gold ? "#FFC83D" : "#FFFFFF" }}>{w}</span>;
};

export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cue = CUES.find((c) => t >= c.from && t < c.to);
  if (!cue) return null;
  const local = (t - cue.from) * fps;
  const pop = spring({ frame: local, fps, config: { damping: 16, stiffness: 180 } });
  const out = interpolate(t, [cue.to - 0.12, cue.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const words = cue.text.split(" ");
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 1190, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: "Noto Sans Telugu",
          fontWeight: 700,
          fontSize: cue.text.length > 28 ? 64 : 76,
          lineHeight: 1.32,
          textAlign: "center",
          letterSpacing: 0.3,
          opacity: Math.min(pop * 1.4, 1) * out,
          transform: `translateY(${(1 - pop) * 26}px) scale(${0.94 + pop * 0.06})`,
          textShadow: "0 4px 18px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.9), 0 2px 0 rgba(0,0,0,0.6)",
          WebkitTextStroke: "1.5px rgba(0,0,0,0.55)",
        }}
      >
        {words.map((w, i) => (
          <React.Fragment key={i}>
            <Word w={w} />
            {i < words.length - 1 ? " " : ""}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
