import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../config";

type Props = {
  accent?: string;
  accent2?: string;
  seed?: string;
  /** Speed of the grid floor moving toward the camera. */
  speed?: number;
  particles?: number;
};

/**
 * Cinematic 3D backdrop: perspective grid floor and ceiling, drifting light
 * orbs, light beams and particles, all under a slowly moving "camera".
 */
export const TechBackground: React.FC<Props> = ({
  accent = BRAND.primary,
  accent2 = BRAND.secondary,
  seed = "bg",
  speed = 2.2,
  particles = 70,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const dots = useMemo(
    () =>
      new Array(particles).fill(0).map((_, i) => ({
        x: random(`${seed}-x-${i}`) * width,
        y: random(`${seed}-y-${i}`) * height,
        size: 1.5 + random(`${seed}-s-${i}`) * 3.5,
        speed: 0.3 + random(`${seed}-v-${i}`) * 1.4,
        phase: random(`${seed}-p-${i}`) * Math.PI * 2,
        tint: random(`${seed}-c-${i}`) > 0.5,
      })),
    [particles, seed, width, height],
  );

  const camRotX = Math.sin(frame / 95) * 2.2;
  const camRotY = Math.sin(frame / 130) * 3.5;
  const camScale = 1.06 + Math.sin(frame / 160) * 0.03;

  const gridLine = (c: string) =>
    `linear-gradient(${c} 2px, transparent 2px), linear-gradient(90deg, ${c} 2px, transparent 2px)`;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 55%, ${accent}33 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 15% 20%, ${accent2}22 0%, transparent 60%),
            linear-gradient(180deg, #060818 0%, ${BRAND.bg} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          perspective: 1100,
          transform: `scale(${camScale}) rotateX(${camRotX}deg) rotateY(${camRotY}deg)`,
        }}
      >
        {/* Floor */}
        <div
          style={{
            position: "absolute",
            left: "-100%",
            width: "300%",
            top: "52%",
            height: "120%",
            transformOrigin: "50% 0%",
            transform: "rotateX(76deg)",
            backgroundImage: gridLine(`${accent}66`),
            backgroundSize: "90px 90px",
            backgroundPosition: `0px ${frame * speed * 3}px`,
            maskImage: "linear-gradient(180deg, transparent 0%, black 25%, black 60%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 18%, black 70%, transparent 100%)",
          }}
        />
        {/* Ceiling */}
        <div
          style={{
            position: "absolute",
            left: "-100%",
            width: "300%",
            bottom: "60%",
            height: "100%",
            transformOrigin: "50% 100%",
            transform: "rotateX(-78deg)",
            backgroundImage: gridLine(`${accent2}26`),
            backgroundSize: "120px 120px",
            backgroundPosition: `0px ${-frame * speed * 2}px`,
            WebkitMaskImage: "linear-gradient(0deg, transparent 0%, black 30%, transparent 100%)",
          }}
        />
      </AbsoluteFill>

      {/* Horizon glow */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: height * 0.5 - 140,
          height: 280,
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${accent}55, transparent 70%)`,
          opacity: 0.8 + Math.sin(frame / 20) * 0.15,
        }}
      />

      {/* Light orbs */}
      {[0, 1, 2].map((i) => {
        const x = width * (0.2 + 0.3 * i) + Math.sin(frame / (70 + i * 23) + i) * 160;
        const y = height * (0.3 + 0.15 * (i % 2)) + Math.cos(frame / (90 + i * 17)) * 90;
        const size = 520 + i * 120;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${i % 2 ? accent2 : accent}30 0%, transparent 65%)`,
            }}
          />
        );
      })}

      {/* Diagonal light beams */}
      {[0, 1, 2, 3].map((i) => {
        const x = ((frame * (1.2 + i * 0.4) + i * 600) % (width + 800)) - 400;
        return (
          <div
            key={`beam-${i}`}
            style={{
              position: "absolute",
              left: x,
              top: -200,
              width: 120 + i * 40,
              height: height + 400,
              transform: "rotate(18deg)",
              background: `linear-gradient(90deg, transparent, ${i % 2 ? accent : accent2}12, transparent)`,
            }}
          />
        );
      })}

      {/* Particles */}
      {dots.map((d, i) => {
        const y = (((d.y - frame * d.speed) % height) + height) % height;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(frame / 25 + d.phase));
        return (
          <div
            key={`p-${i}`}
            style={{
              position: "absolute",
              left: d.x + Math.sin(frame / 50 + d.phase) * 12,
              top: y,
              width: d.size,
              height: d.size,
              borderRadius: "50%",
              backgroundColor: d.tint ? accent2 : "#ffffff",
              opacity: tw * 0.8,
              boxShadow: `0 0 ${d.size * 4}px ${d.tint ? accent2 : accent}`,
            }}
          />
        );
      })}

      {/* Scanlines + vignette */}
      <AbsoluteFill
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 4px)",
          opacity: interpolate(Math.sin(frame / 8), [-1, 1], [0.5, 0.8]),
        }}
      />
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.75) 100%)" }}
      />
    </AbsoluteFill>
  );
};
