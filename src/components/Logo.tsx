import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { BRAND } from "../config";
import { displayFont } from "../fonts";
import { MEDIA } from "../media";

/** Hexagon "N" emblem that draws itself, then lights up. */
export const Emblem: React.FC<{ size: number; delay?: number }> = ({ size, delay = 0 }) => {
  const frame = useCurrentFrame() - delay;
  const draw = interpolate(frame, [0, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const drawN = interpolate(frame, [18, 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const fill = interpolate(frame, [45, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = 0.6 + 0.4 * Math.sin(frame / 12);

  if (MEDIA.logo) {
    const s = interpolate(frame, [0, 30], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.6)) });
    return (
      <Img
        src={staticFile(MEDIA.logo)}
        style={{ width: size, height: size, objectFit: "contain", transform: `scale(${s})`, opacity: Math.min(1, frame / 15) }}
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="nx-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BRAND.secondary} />
          <stop offset="100%" stopColor={BRAND.primary} />
        </linearGradient>
        <filter id="nx-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon
        points="100,8 180,54 180,146 100,192 20,146 20,54"
        fill="url(#nx-grad)"
        opacity={fill * 0.18}
      />
      <polygon
        points="100,8 180,54 180,146 100,192 20,146 20,54"
        fill="none"
        stroke="url(#nx-grad)"
        strokeWidth={7}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
        filter="url(#nx-glow)"
      />
      <path
        d="M66 140 V60 L134 140 V60"
        fill="none"
        stroke="#ffffff"
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - drawN}
        filter="url(#nx-glow)"
        opacity={0.85 + 0.15 * pulse * fill}
      />
    </svg>
  );
};

/** NOVATRIX wordmark: letters assemble with blur, spacing tightens, a light sweep passes. */
export const Wordmark: React.FC<{ fontSize: number; delay?: number; showTagline?: boolean }> = ({
  fontSize,
  delay = 0,
  showTagline = true,
}) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const letters = BRAND.name.split("");
  const spacing = interpolate(frame, [0, 45], [0.6, 0.16], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const sweep = interpolate(frame, [30, 75], [-60, 160], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tag = spring({ frame: frame - 40, fps, config: { damping: 200 } });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", display: "flex", letterSpacing: `${spacing}em`, marginRight: `-${spacing}em` }}>
        {letters.map((l, i) => {
          const f = frame - i * 3;
          const o = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const blur = interpolate(f, [0, 16], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(f, [0, 18], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
          return (
            <span
              key={i}
              style={{
                fontFamily: displayFont,
                fontWeight: 700,
                fontSize,
                lineHeight: 1,
                color: "transparent",
                backgroundImage: `linear-gradient(100deg, #ffffff 0%, #dfe7ff ${sweep - 12}%, #ffffff ${sweep}%, ${BRAND.secondary} ${sweep + 6}%, #c9d4ff ${sweep + 14}%, #ffffff 100%)`,
                backgroundSize: `${letters.length * 100}% 100%`,
                backgroundPosition: `${(i / (letters.length - 1)) * 100}% 0`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                opacity: o,
                filter: `blur(${blur}px) drop-shadow(0 0 ${fontSize * 0.18}px ${BRAND.primary}aa)`,
                transform: `translateY(${y}px)`,
                display: "inline-block",
              }}
            >
              {l}
            </span>
          );
        })}
      </div>
      {showTagline ? (
        <div
          style={{
            marginTop: fontSize * 0.28,
            fontFamily: displayFont,
            fontWeight: 500,
            fontSize: fontSize * 0.2,
            letterSpacing: "0.45em",
            textTransform: "uppercase",
            color: "#b9c6ff",
            opacity: tag,
            transform: `translateY(${(1 - tag) * 20}px)`,
          }}
        >
          {BRAND.tagline}
        </div>
      ) : null}
    </div>
  );
};
