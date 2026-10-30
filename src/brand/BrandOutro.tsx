import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CinematicBackdrop } from "../components/CinematicBackdrop";
import { useFormat } from "../engine/format";
import { SceneTiming } from "../engine/timeline";
import { COLORS, FONTS } from "./theme";
import { Wordmark } from "./Wordmark";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/**
 * Sign-off. Landscape ends on an end screen with two frames reserved for
 * YouTube end-screen elements; Shorts end on the wordmark and a subscribe line.
 */
export const BrandOutro: React.FC<{ timing: SceneTiming }> = ({ timing }) => {
  const frame = useCurrentFrame();
  const { vertical, u } = useFormat();
  const narrationEnd = timing.sentences.length ? timing.sentences[timing.sentences.length - 1].to : 60;
  const endScreen = vertical ? 0 : interpolate(frame, [narrationEnd + 10, narrationEnd + 40], [0, 1], clamp);
  const sub = interpolate(frame, [narrationEnd, narrationEnd + 25], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <CinematicBackdrop seed="outro" light={0.9} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: vertical ? "center" : "flex-start",
          paddingTop: vertical ? 0 : interpolate(endScreen, [0, 1], [380, 120]) * u,
        }}
      >
        <Wordmark size={(vertical ? 150 : interpolate(endScreen, [0, 1], [180, 120])) * u} delay={4} sweepAt={40} />
        <div
          style={{
            marginTop: 44 * u,
            padding: `${14 * u}px ${36 * u}px`,
            border: `1px solid ${COLORS.gold}`,
            fontFamily: FONTS.sans,
            fontWeight: 600,
            fontSize: (vertical ? 28 : 22) * u,
            letterSpacing: "0.32em",
            color: COLORS.goldLight,
            opacity: sub,
          }}
        >
          SUBSCRIBE FOR MORE UNTOLD STORIES
        </div>
      </AbsoluteFill>
      {!vertical
        ? [
            { left: 200, label: "Next story" },
            { left: 1000, label: "Recommended" },
          ].map((slot, i) => (
            <div
              key={slot.label}
              style={{
                position: "absolute",
                left: slot.left * u,
                top: 560 * u,
                width: 720 * u,
                height: 405 * u,
                border: `1px solid rgba(184,154,94,0.55)`,
                background: "rgba(0,0,0,0.35)",
                opacity: interpolate(endScreen, [0, 1], [0, 1]) * (i ? 0.9 : 1),
                display: "flex",
                alignItems: "flex-end",
                padding: 22 * u,
                boxSizing: "border-box",
                fontFamily: FONTS.serif,
                fontStyle: "italic",
                fontSize: 30 * u,
                color: COLORS.ash,
              }}
            >
              {slot.label}
            </div>
          ))
        : null}
    </AbsoluteFill>
  );
};
