import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../brand/theme";
import { CinematicBackdrop } from "../components/CinematicBackdrop";
import { useFormat } from "../engine/format";
import { reveal } from "./anim";

/** Film title: each line lands on its own beat (pair with "impact" SFX). */
export const TitleScene: React.FC<{ title: string[]; kicker?: string }> = ({ title, kicker }) => {
  const frame = useCurrentFrame();
  const { vertical, u } = useFormat();
  return (
    <AbsoluteFill>
      <CinematicBackdrop seed="title" light={0.6} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {kicker ? (
          <div
            style={{
              ...reveal(frame, 0, 20),
              fontFamily: FONTS.sans,
              fontWeight: 600,
              fontSize: (vertical ? 24 : 20) * u,
              letterSpacing: "0.5em",
              marginRight: "-0.5em",
              color: COLORS.gold,
              marginBottom: 40 * u,
            }}
          >
            {kicker}
          </div>
        ) : null}
        {title.map((line, i) => (
          <div
            key={i}
            style={{
              ...reveal(frame, 15 + i * 33, 14),
              fontFamily: FONTS.serif,
              fontWeight: 700,
              fontSize: (vertical ? 128 : 150) * u,
              lineHeight: 1.02,
              letterSpacing: "0.04em",
              color: i === title.length - 1 ? COLORS.goldLight : COLORS.bone,
            }}
          >
            {line}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
