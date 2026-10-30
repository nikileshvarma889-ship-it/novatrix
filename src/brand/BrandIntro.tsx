import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CinematicBackdrop } from "../components/CinematicBackdrop";
import { useFormat } from "../engine/format";
import { Wordmark } from "./Wordmark";

/** Channel ident: darkness, a sliver of light, the wordmark, the tagline. */
export const BrandIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { vertical, u } = useFormat();
  const light = interpolate(frame, [0, 40, durationInFrames - 20, durationInFrames], [0, 0.9, 0.9, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const push = interpolate(frame, [0, durationInFrames], [1, 1.06]);
  return (
    <AbsoluteFill>
      <CinematicBackdrop seed="ident" light={light} dust={50} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${push})` }}>
        <Wordmark size={(vertical ? 170 : 210) * u} delay={8} sweepAt={70} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
