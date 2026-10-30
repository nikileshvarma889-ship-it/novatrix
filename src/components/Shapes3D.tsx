import React from "react";
import { useCurrentFrame } from "remotion";

/** A glowing wireframe cube built from six CSS 3D faces. */
export const WireCube: React.FC<{
  size: number;
  color: string;
  x: number;
  y: number;
  z?: number;
  speed?: number;
  opacity?: number;
}> = ({ size, color, x, y, z = 0, speed = 1, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const half = size / 2;
  const faces = [
    `translateZ(${half}px)`,
    `rotateY(180deg) translateZ(${half}px)`,
    `rotateY(90deg) translateZ(${half}px)`,
    `rotateY(-90deg) translateZ(${half}px)`,
    `rotateX(90deg) translateZ(${half}px)`,
    `rotateX(-90deg) translateZ(${half}px)`,
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: x - half,
        top: y - half + Math.sin(frame / 30) * 14,
        width: size,
        height: size,
        transformStyle: "preserve-3d",
        transform: `translateZ(${z}px) rotateX(${frame * 0.9 * speed}deg) rotateY(${frame * 1.3 * speed}deg)`,
        opacity,
      }}
    >
      {faces.map((t, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            border: `2px solid ${color}`,
            background: `${color}10`,
            boxShadow: `0 0 18px ${color}88, inset 0 0 18px ${color}55`,
            transform: t,
          }}
        />
      ))}
    </div>
  );
};

/** Concentric glowing rings arranged in depth; `travel` moves the camera through them. */
export const RingTunnel: React.FC<{ colors: string[]; travel: number; rings?: number; opacity?: number }> = ({
  colors,
  travel,
  rings = 12,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        perspective: 900,
        opacity,
        transformStyle: "preserve-3d",
      }}
    >
      {new Array(rings).fill(0).map((_, i) => {
        const z = -i * 420 + travel;
        const fade = z > 600 ? 0 : z > 200 ? 1 - (z - 200) / 400 : Math.min(1, 1 + z / 4600);
        const c = colors[i % colors.length];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 900,
              height: 900,
              marginLeft: -450,
              marginTop: -450,
              borderRadius: "50%",
              border: `3px solid ${c}`,
              boxShadow: `0 0 40px ${c}aa, inset 0 0 40px ${c}66`,
              transform: `translateZ(${z}px) rotateZ(${frame * (i % 2 ? 0.6 : -0.6) + i * 30}deg) scaleY(${i % 3 === 0 ? 1 : 0.98})`,
              borderStyle: i % 2 ? "solid" : "dashed",
              opacity: Math.max(0, fade),
            }}
          />
        );
      })}
    </div>
  );
};
