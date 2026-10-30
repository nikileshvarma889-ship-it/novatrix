import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Asset, Motion } from "../engine/types";
import { COLORS, FONTS } from "../brand/theme";
import { useFormat } from "../engine/format";
import { Background } from "./Background";
import { progress, reveal } from "./anim";

/** Date / place card over (dimmed) footage. */
export const DateScene: React.FC<{
  slug: string;
  id: string;
  date: string;
  place?: string;
  detail?: string;
  visual?: string;
  asset?: Asset;
  motion?: Motion;
}> = ({ slug, id, date, place, detail, visual, asset, motion }) => {
  const frame = useCurrentFrame();
  const { vertical, u } = useFormat();
  return (
    <AbsoluteFill>
      <Background slug={slug} visual={visual} asset={asset} motion={motion} seed={id} dim={0.55} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: vertical ? "center" : "flex-start",
          textAlign: vertical ? "center" : "left",
          padding: `0 ${(vertical ? 70 : 150) * u}px`,
          marginTop: (vertical ? -260 : -60) * u,
        }}
      >
        {place ? (
          <div style={{ ...reveal(frame, 20), fontFamily: FONTS.sans, fontWeight: 600, fontSize: (vertical ? 26 : 22) * u, letterSpacing: "0.32em", color: COLORS.gold, textTransform: "uppercase" }}>
            {place}
          </div>
        ) : null}
        <div style={{ width: 140 * u * progress(frame, 8, 36), height: 1, background: COLORS.gold, margin: `${22 * u}px 0` }} />
        <div style={{ ...reveal(frame, 4, 30), fontFamily: FONTS.serif, fontWeight: 600, fontSize: (vertical ? 110 : 128) * u, lineHeight: 1, color: COLORS.bone }}>
          {date}
        </div>
        {detail ? (
          <div style={{ ...reveal(frame, 34), marginTop: 22 * u, fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 40 * u, color: COLORS.ash }}>
            {detail}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
