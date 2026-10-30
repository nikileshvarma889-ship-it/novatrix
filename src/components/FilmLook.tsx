import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";

/**
 * Consistent cinematic finish applied over every scene: subtle warm grade,
 * vignette and animated film grain.
 */
export const FilmLook: React.FC<{ grain?: number; vignette?: number }> = ({ grain = 0.09, vignette = 0.75 }) => {
  const frame = useCurrentFrame();
  const ox = Math.floor(random(`gx${frame}`) * 200);
  const oy = Math.floor(random(`gy${frame}`) * 200);
  const noise = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1.2 -0.1'/></filter><rect width='256' height='256' filter='url(%23n)'/></svg>")`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(30,24,14,0.10), rgba(10,14,18,0.12))", mixBlendMode: "multiply" }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 75% at 50% 50%, transparent 50%, rgba(0,0,0,${vignette}) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: noise,
          backgroundSize: "256px 256px",
          backgroundPosition: `${ox}px ${oy}px`,
          opacity: grain,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};
