import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Asset } from "../engine/types";
import { PROVENANCE_LABELS } from "../config";
import { COLORS, FONTS } from "../brand/theme";
import { useFormat } from "../engine/format";

/** Small, honest label telling viewers what kind of image they are seeing. */
export const provenanceText = (asset: Asset) => {
  if (asset.label !== undefined) return asset.label;
  const base = PROVENANCE_LABELS[asset.kind];
  if (!base) return "";
  return asset.credit ? `${base} · ${asset.credit}` : base;
};

export const ProvenanceTag: React.FC<{ asset: Asset }> = ({ asset }) => {
  const frame = useCurrentFrame();
  const { vertical, u } = useFormat();
  const text = provenanceText(asset);
  if (!text) return null;
  const o = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: (vertical ? 150 : 48) * u,
        left: (vertical ? 60 : 64) * u,
        display: "flex",
        alignItems: "center",
        gap: 12 * u,
        fontFamily: FONTS.sans,
        fontWeight: 600,
        fontSize: (vertical ? 22 : 17) * u,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: COLORS.bone,
        opacity: o * 0.8,
        textShadow: "0 1px 4px rgba(0,0,0,0.9)",
      }}
    >
      <span style={{ width: 22 * u, height: 1.5 * u, background: COLORS.gold }} />
      {text}
    </div>
  );
};
