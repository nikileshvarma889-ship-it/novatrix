import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

loadFont({ family: "Fredoka", url: staticFile("fonts/fredoka-latin-600-normal.woff2"), weight: "600" });
loadFont({ family: "Fredoka", url: staticFile("fonts/fredoka-latin-700-normal.woff2"), weight: "700" });

export const LETTER_COLORS = ["#ff4b6e", "#ff9a3c", "#ffd23f", "#4cd964", "#3fb5ff", "#8a6bff", "#ff6fcf"];

/** Chunky toy-like letters: coloured face, darker extruded edge, white rim. */
export const ToyLetter: React.FC<{ ch: string; color: string; size: number }> = ({ ch, color, size }) => {
  const depth = Array.from({ length: 8 }, (_, i) => `0 ${i + 1}px 0 color-mix(in srgb, ${color} 62%, #000)`).join(", ");
  return (
    <span
      style={{
        fontFamily: "Fredoka",
        fontWeight: 700,
        fontSize: size,
        color,
        lineHeight: 1,
        WebkitTextStroke: `${size * 0.035}px #ffffff`,
        paintOrder: "stroke fill",
        textShadow: `${depth}, 0 ${size * 0.12}px ${size * 0.15}px rgba(0,0,0,0.25)`,
        display: "inline-block",
      }}
    >
      {ch}
    </span>
  );
};

export const PoppiloLogo: React.FC<{ startFrame: number; size?: number }> = ({ startFrame, size = 170 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", gap: size * 0.02 }}>
      {"POPPILO".split("").map((ch, i) => {
        const f = frame - startFrame - i * 4.5;
        const s = spring({ frame: f, fps, config: { damping: 9, stiffness: 140 } });
        const bob = f > 20 ? Math.sin((frame + i * 6) / 7) * size * 0.04 : 0;
        return (
          <div key={i} style={{ transform: `translateY(${(1 - s) * -size * 1.4 + bob}px) scale(${0.3 + 0.7 * s}) rotate(${(1 - s) * (i % 2 ? 25 : -25)}deg)`, opacity: Math.min(1, f / 3) }}>
            <ToyLetter ch={ch} color={LETTER_COLORS[i]} size={size} />
          </div>
        );
      })}
    </div>
  );
};

export const EndCard: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < startFrame - 2) return null;
  const tag = spring({ frame: frame - startFrame - 48, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 90 }}>
      <PoppiloLogo startFrame={startFrame} />
      <div
        style={{
          marginTop: 26,
          padding: "14px 34px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          fontFamily: "Fredoka",
          fontWeight: 600,
          fontSize: 40,
          letterSpacing: "0.06em",
          color: "#3b3b6d",
          transform: `scale(${tag})`,
          opacity: tag,
        }}
      >
        LITTLE STORIES. BIG IMAGINATIONS.
      </div>
    </AbsoluteFill>
  );
};

export const TitleCard: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from || frame > to) return null;
  const s = spring({ frame: frame - from, fps, config: { damping: 12 } });
  const out = interpolate(frame, [to - 12, to], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 70, opacity: out }}>
      <div style={{ transform: `scale(${s})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <PoppiloLogo startFrame={from} size={64} />
        <div
          style={{
            marginTop: 10,
            padding: "12px 36px",
            borderRadius: 999,
            background: "#ffffff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            fontFamily: "Fredoka",
            fontWeight: 700,
            fontSize: 58,
            color: "#ff5a7a",
          }}
        >
          The Little Animal Parade
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Flash: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at - 3, at, at + 8], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return o > 0 ? <AbsoluteFill style={{ background: "#ffffff", opacity: o }} /> : null;
};
