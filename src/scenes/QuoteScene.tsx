import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Asset, Motion } from "../engine/types";
import { COLORS, FONTS } from "../brand/theme";
import { useFormat } from "../engine/format";
import { Background } from "./Background";
import { reveal } from "./anim";

/** A real quote or document, with translation and attribution. */
export const QuoteScene: React.FC<{
  slug: string;
  id: string;
  quote: string;
  translation?: string;
  attribution: string;
  visual?: string;
  asset?: Asset;
  motion?: Motion;
}> = ({ slug, id, quote, translation, attribution, visual, asset, motion }) => {
  const frame = useCurrentFrame();
  const { vertical, u } = useFormat();
  return (
    <AbsoluteFill>
      <Background slug={slug} visual={visual} asset={asset} motion={motion} seed={id} dim={0.65} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: `0 ${(vertical ? 70 : 220) * u}px`, marginTop: (vertical ? -260 : -40) * u }}>
        <div style={{ ...reveal(frame, 10, 40), fontFamily: FONTS.serif, fontStyle: "italic", fontWeight: 500, fontSize: (vertical ? 76 : 88) * u, lineHeight: 1.15, color: COLORS.bone }}>
          “{quote}”
        </div>
        {translation ? (
          <div style={{ ...reveal(frame, 60, 30), marginTop: 30 * u, fontFamily: FONTS.serif, fontSize: 44 * u, color: COLORS.goldLight }}>
            {translation}
          </div>
        ) : null}
        <div style={{ ...reveal(frame, 80), marginTop: 36 * u, fontFamily: FONTS.sans, fontWeight: 600, fontSize: (vertical ? 22 : 18) * u, letterSpacing: "0.28em", color: COLORS.ash, textTransform: "uppercase" }}>
          {attribution}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
