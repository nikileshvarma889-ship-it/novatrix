import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../brand/theme";
import { CinematicBackdrop } from "../components/CinematicBackdrop";
import { useFormat } from "../engine/format";
import { progress, reveal } from "./anim";

export const ChapterScene: React.FC<{ number: string; title: string }> = ({ number, title }) => {
  const frame = useCurrentFrame();
  const { vertical, u } = useFormat();
  const line = progress(frame, 6, 36);
  return (
    <AbsoluteFill>
      <CinematicBackdrop seed={`ch-${number}`} light={0.7} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: 80 * u }}>
        <div style={{ ...reveal(frame, 0), fontFamily: FONTS.sans, fontWeight: 600, fontSize: 20 * u, letterSpacing: "0.5em", marginRight: "-0.5em", color: COLORS.gold }}>
          CHAPTER {number}
        </div>
        <div style={{ width: 260 * u * line, height: 1, background: COLORS.gold, margin: `${26 * u}px 0` }} />
        <div style={{ ...reveal(frame, 12, 30), fontFamily: FONTS.serif, fontWeight: 500, fontSize: (vertical ? 96 : 104) * u, color: COLORS.bone, lineHeight: 1.05 }}>
          {title}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
