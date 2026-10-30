import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Cue } from "../engine/timeline";
import { COLORS, FONTS } from "../brand/theme";
import { useFormat } from "../engine/format";

/**
 * Broadcast-style documentary subtitles: clean sans-serif, soft shadow, no box.
 * Positioned inside YouTube's safe area for both 16:9 and Shorts.
 */
export const Subtitles: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { vertical, u } = useFormat();
  const cue = cues.find((c) => frame >= c.from && frame < c.to);
  if (!cue) return null;

  const fadeIn = interpolate(frame, [cue.from, cue.from + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [cue.to - 4, cue.to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // Shorts: keep clear of the caption/buttons area at the bottom and right.
        bottom: (vertical ? 520 : 72) * u,
        padding: `0 ${(vertical ? 90 : 240) * u}px`,
        display: "flex",
        justifyContent: "center",
        opacity: Math.min(fadeIn, fadeOut),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "10%",
          right: "10%",
          top: -40 * u,
          bottom: -40 * u,
          background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,0.55), transparent 80%)",
        }}
      />
      <div
        style={{
          position: "relative",
          textAlign: "center",
          fontFamily: FONTS.sans,
          fontWeight: 600,
          fontSize: (vertical ? 54 : 42) * u,
          lineHeight: 1.3,
          color: COLORS.bone,
          textShadow: "0 2px 3px rgba(0,0,0,0.95), 0 0 18px rgba(0,0,0,0.85)",
          maxWidth: (vertical ? 900 : 1440) * u,
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};
