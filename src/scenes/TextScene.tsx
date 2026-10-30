import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../brand/theme";
import { CinematicBackdrop } from "../components/CinematicBackdrop";
import { useFormat } from "../engine/format";
import { Span } from "../engine/timeline";
import { reveal } from "./anim";

/** Lines of text on black. With narration, each line appears with its sentence. */
export const TextScene: React.FC<{ id: string; lines: string[]; sentences: Span[] }> = ({ id, lines, sentences }) => {
  const frame = useCurrentFrame();
  const { vertical, u } = useFormat();
  return (
    <AbsoluteFill>
      <CinematicBackdrop seed={id} light={0.5} dust={25} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: `0 ${(vertical ? 80 : 200) * u}px`, marginTop: (vertical ? -240 : -40) * u }}>
        {lines.map((line, i) => {
          const at = sentences.length === lines.length ? sentences[i].from : 10 + i * 30;
          return (
            <div key={i} style={{ ...reveal(frame, at, 28), fontFamily: FONTS.serif, fontWeight: 500, fontSize: (vertical ? 68 : 64) * u, lineHeight: 1.25, color: i === lines.length - 1 ? COLORS.goldLight : COLORS.bone }}>
              {line}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
