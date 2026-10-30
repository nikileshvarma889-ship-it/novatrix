import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Asset, Motion } from "../engine/types";
import { COLORS, FONTS } from "../brand/theme";
import { useFormat } from "../engine/format";
import { Background } from "./Background";
import { reveal } from "./anim";

export const FootageScene: React.FC<{
  slug: string;
  id: string;
  visual?: string;
  asset?: Asset;
  motion?: Motion;
  caption?: string;
  lowerThird?: { name: string; role: string };
}> = ({ slug, id, visual, asset, motion, caption, lowerThird }) => {
  const frame = useCurrentFrame();
  const { vertical, u } = useFormat();
  return (
    <AbsoluteFill>
      <Background slug={slug} visual={visual} asset={asset} motion={motion} seed={id} dim={0.2} />
      {lowerThird ? (
        <div style={{ position: "absolute", left: 90 * u, bottom: (vertical ? 760 : 230) * u, ...reveal(frame, 20) }}>
          <div style={{ fontFamily: FONTS.serif, fontWeight: 600, fontSize: 52 * u, color: COLORS.bone }}>{lowerThird.name}</div>
          <div style={{ width: 80 * u, height: 1, background: COLORS.gold, margin: `${10 * u}px 0` }} />
          <div style={{ fontFamily: FONTS.sans, fontSize: 22 * u, letterSpacing: "0.2em", color: COLORS.goldLight, textTransform: "uppercase" }}>
            {lowerThird.role}
          </div>
        </div>
      ) : null}
      {caption ? (
        <div
          style={{
            position: "absolute",
            right: 64 * u,
            top: (vertical ? 150 : 48) * u,
            maxWidth: 700 * u,
            textAlign: "right",
            fontFamily: FONTS.serif,
            fontStyle: "italic",
            fontSize: (vertical ? 30 : 28) * u,
            color: COLORS.goldLight,
            textShadow: "0 1px 6px rgba(0,0,0,0.9)",
            ...reveal(frame, 30),
          }}
        >
          {caption}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
