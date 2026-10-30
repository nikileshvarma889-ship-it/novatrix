import React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { MEDIA } from "../engine/media";
import { COLORS, FONTS, BRAND } from "./theme";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/**
 * THE UNTOLD wordmark. Hairline rules draw outward, "UNTOLD" resolves from
 * soft focus while its tracking settles, then a slow gold light passes over it.
 * Drop public/brand/logo.png to use your own logo instead.
 */
export const Wordmark: React.FC<{ size: number; delay?: number; tagline?: boolean; sweepAt?: number }> = ({
  size,
  delay = 0,
  tagline = true,
  sweepAt = 60,
}) => {
  const f = useCurrentFrame() - delay;
  const rule = interpolate(f, [0, 34], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const the = interpolate(f, [12, 34], [0, 1], clamp);
  const reveal = interpolate(f, [18, 62], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tracking = interpolate(reveal, [0, 1], [0.55, 0.2]);
  const sweep = interpolate(f, [sweepAt, sweepAt + 50], [-30, 130], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const tag = interpolate(f, [sweepAt + 20, sweepAt + 50], [0, 1], clamp);

  if (MEDIA.brand.logo) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: reveal }}>
        <Img src={staticFile(MEDIA.brand.logo)} style={{ height: size * 1.4, objectFit: "contain" }} />
        {tagline ? <Tagline size={size} o={tag} /> : null}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
        <div style={{ width: size * 1.1 * rule, height: Math.max(1, size * 0.012), background: `linear-gradient(90deg, transparent, ${COLORS.gold})` }} />
        <div
          style={{
            fontFamily: FONTS.sans,
            fontWeight: 600,
            fontSize: size * 0.17,
            letterSpacing: "0.6em",
            marginRight: "-0.6em",
            color: COLORS.gold,
            opacity: the,
          }}
        >
          THE
        </div>
        <div style={{ width: size * 1.1 * rule, height: Math.max(1, size * 0.012), background: `linear-gradient(270deg, transparent, ${COLORS.gold})` }} />
      </div>
      <div
        style={{
          marginTop: size * 0.06,
          fontFamily: FONTS.serif,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1,
          letterSpacing: `${tracking}em`,
          marginRight: `-${tracking}em`,
          color: "transparent",
          backgroundImage: `linear-gradient(100deg, ${COLORS.bone} 0%, ${COLORS.bone} ${sweep - 14}%, ${COLORS.goldLight} ${sweep}%, ${COLORS.bone} ${sweep + 14}%, ${COLORS.bone} 100%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          opacity: reveal,
          filter: `blur(${(1 - reveal) * 10}px)`,
        }}
      >
        UNTOLD
      </div>
      {tagline ? <Tagline size={size} o={tag} /> : null}
    </div>
  );
};

const Tagline: React.FC<{ size: number; o: number }> = ({ size, o }) => (
  <div
    style={{
      marginTop: size * 0.22,
      fontFamily: FONTS.serif,
      fontStyle: "italic",
      fontWeight: 500,
      fontSize: size * 0.26,
      color: COLORS.ash,
      opacity: o,
      transform: `translateY(${(1 - o) * 8}px)`,
    }}
  >
    {BRAND.tagline}
  </div>
);
