import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { TransitionId } from "./types";

/** Fade the outgoing scene to black, then the incoming scene up from black. */
const DipToBlack: React.FC<TransitionPresentationComponentProps<Record<string, unknown>>> = ({
  children,
  presentationDirection,
  presentationProgress,
}) => {
  const opacity =
    presentationDirection === "exiting"
      ? interpolate(presentationProgress, [0, 0.5], [1, 0], { extrapolateRight: "clamp" })
      : interpolate(presentationProgress, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" });
  return <AbsoluteFill style={{ opacity, backgroundColor: "#000" }}>{children}</AbsoluteFill>;
};

const dipToBlack = (): TransitionPresentation<Record<string, unknown>> => ({ component: DipToBlack, props: {} });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const presentationFor = (id: TransitionId): TransitionPresentation<any> | null => {
  switch (id) {
    case "cut":
      return null;
    case "dip-to-black":
      return dipToBlack();
    case "slide-up":
      return slide({ direction: "from-bottom" });
    default:
      return fade();
  }
};
