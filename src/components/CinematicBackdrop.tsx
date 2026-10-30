import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../brand/theme";

/**
 * Low-key "studio darkness" backdrop: charcoal gradient, a slow pool of warm
 * light, drifting dust caught in the light. Used behind text scenes and as
 * the base under footage placeholders.
 */
export const CinematicBackdrop: React.FC<{ seed?: string; light?: number; dust?: number }> = ({
  seed = "bd",
  light = 1,
  dust = 40,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const motes = useMemo(
    () =>
      new Array(dust).fill(0).map((_, i) => ({
        x: random(`${seed}x${i}`),
        y: random(`${seed}y${i}`),
        r: 0.8 + random(`${seed}r${i}`) * 2.2,
        vx: (random(`${seed}vx${i}`) - 0.5) * 0.25,
        vy: -0.08 - random(`${seed}vy${i}`) * 0.22,
        p: random(`${seed}p${i}`) * Math.PI * 2,
      })),
    [dust, seed],
  );

  const lx = 50 + Math.sin(frame / 240) * 8;
  const ly = 38 + Math.cos(frame / 300) * 5;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at ${lx}% ${ly}%, rgba(184,154,94,${0.16 * light}) 0%, rgba(40,36,30,${0.35 * light}) 35%, transparent 70%),
            linear-gradient(180deg, ${COLORS.charcoal} 0%, ${COLORS.black} 100%)`,
        }}
      />
      {/* Volumetric light shaft */}
      <div
        style={{
          position: "absolute",
          left: `${lx - 25}%`,
          top: "-20%",
          width: "50%",
          height: "140%",
          transform: "rotate(14deg)",
          background: `linear-gradient(90deg, transparent, rgba(216,192,140,${0.05 * light}), transparent)`,
        }}
      />
      {motes.map((m, i) => {
        const x = (((m.x * width + frame * m.vx * 3) % width) + width) % width;
        const y = (((m.y * height + frame * m.vy * 3) % height) + height) % height;
        const tw = 0.25 + 0.5 * Math.abs(Math.sin(frame / 45 + m.p));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: m.r,
              height: m.r,
              borderRadius: "50%",
              background: COLORS.goldLight,
              opacity: tw * 0.55 * light,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
