import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { TOOLS } from "../content/tools";
import { displayFont } from "../fonts";

/** Top "1 of 7" tracker so viewers always know where they are. */
export const ProgressRail: React.FC<{ current: number; accent: string }> = ({ current, accent }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [4, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 14,
        opacity: enter,
        transform: `translateY(${(1 - enter) * -20}px)`,
      }}
    >
      {TOOLS.map((t) => {
        const active = t.number === current;
        const done = t.number < current;
        return (
          <div
            key={t.id}
            style={{
              height: 38,
              padding: active ? "0 20px" : 0,
              width: active ? undefined : 38,
              borderRadius: 19,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 18,
              color: active ? "#05060f" : done ? "#ffffffcc" : "#ffffff66",
              background: active ? accent : done ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${active ? accent : "rgba(255,255,255,0.15)"}`,
              boxShadow: active ? `0 0 24px ${accent}88` : "none",
              letterSpacing: "0.04em",
            }}
          >
            {active ? `${t.number} / 7 · ${t.name.toUpperCase()}` : t.number}
          </div>
        );
      })}
    </div>
  );
};
