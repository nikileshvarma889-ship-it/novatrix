import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Asset, Motion } from "../engine/types";
import { COLORS, FONTS } from "../brand/theme";
import { useFormat } from "../engine/format";
import { Background } from "./Background";
import { progress, reveal } from "./anim";

export const StatScene: React.FC<{ slug: string; id: string; value: string; unit?: string; label: string; visual?: string; asset?: Asset; motion?: Motion }> = ({
  slug,
  id,
  value,
  unit,
  label,
  visual,
  asset,
  motion,
}) => {
  const frame = useCurrentFrame();
  const { vertical, u } = useFormat();
  return (
    <AbsoluteFill>
      <Background slug={slug} visual={visual} asset={asset} motion={motion} seed={id} dim={0.6} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", marginTop: (vertical ? -240 : -40) * u }}>
        <div style={{ ...reveal(frame, 0, 36), fontFamily: FONTS.serif, fontWeight: 600, fontSize: (vertical ? 230 : 260) * u, lineHeight: 0.95, color: COLORS.bone }}>
          {value}
          {unit ? <span style={{ fontSize: "0.35em", color: COLORS.gold, marginLeft: "0.2em" }}>{unit}</span> : null}
        </div>
        <div style={{ width: 200 * u * progress(frame, 18, 48), height: 1, background: COLORS.gold, margin: `${56 * u}px 0 ${26 * u}px` }} />
        <div style={{ ...reveal(frame, 24), fontFamily: FONTS.sans, fontWeight: 600, fontSize: (vertical ? 32 : 26) * u, letterSpacing: "0.4em", marginRight: "-0.4em", color: COLORS.goldLight, textTransform: "uppercase" }}>
          {label}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
