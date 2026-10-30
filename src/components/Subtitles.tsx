import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Cue } from "../timeline";
import { bodyFont } from "../fonts";

/**
 * Broadcast-style subtitles. The active cue pops in, and words light up
 * in time with the narration (estimated from character position).
 */
export const Subtitles: React.FC<{ cues: Cue[]; accent: string; bottom?: number }> = ({
  cues,
  accent,
  bottom = 70,
}) => {
  const frame = useCurrentFrame();
  const cue = cues.find((c) => frame >= c.from && frame < c.to);
  if (!cue) return null;

  const local = frame - cue.from;
  const len = Math.max(1, cue.to - cue.from);
  const appear = interpolate(local, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const disappear = interpolate(frame, [cue.to - 4, cue.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(appear, disappear);

  const words = cue.text.split(/\s+/);
  const totalChars = words.reduce((a, w) => a + w.length + 1, 0);
  const progress = (local / len) * totalChars;
  let acc = 0;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${(1 - appear) * 14}px) scale(${0.97 + appear * 0.03})`,
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          padding: "16px 34px",
          borderRadius: 18,
          background: "rgba(4, 6, 18, 0.72)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px ${accent}22`,
          textAlign: "center",
          fontFamily: bodyFont,
          fontWeight: 600,
          fontSize: 46,
          lineHeight: 1.3,
          color: "#ffffff",
          textShadow: "0 2px 6px rgba(0,0,0,0.8)",
        }}
      >
        {words.map((w, i) => {
          const start = acc;
          acc += w.length + 1;
          const spoken = progress >= start;
          const current = spoken && progress < acc;
          return (
            <span
              key={i}
              style={{
                color: current ? accent : spoken ? "#ffffff" : "rgba(255,255,255,0.55)",
                marginRight: i < words.length - 1 ? "0.28em" : 0,
                display: "inline-block",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};
