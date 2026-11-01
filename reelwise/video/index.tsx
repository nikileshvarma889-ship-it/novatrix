import React from "react";
import { Composition, registerRoot, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import { ReelwiseThumbnail, ReelwiseVideo, totalFrames } from "./Video";
import { DIMENSIONS, FPS, VideoProps } from "./types";

// Telugu (and other Indic) text needs a font the renderer always has.
loadFont({ family: "Noto Sans Telugu", url: staticFile("fonts/NotoSansTelugu-500.woff2"), weight: "500" });

const Root: React.FC = () => (
  <>
    <Composition
      id="ReelwiseVideo"
      component={ReelwiseVideo as unknown as React.FC<Record<string, unknown>>}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={300}
      calculateMetadata={({ props }) => {
        const p = props as unknown as VideoProps;
        return { durationInFrames: totalFrames(p), ...DIMENSIONS[p.aspect] };
      }}
    />
    <Composition
      id="ReelwiseThumbnail"
      component={ReelwiseThumbnail as unknown as React.FC<Record<string, unknown>>}
      fps={FPS}
      width={1280}
      height={720}
      durationInFrames={1}
      calculateMetadata={({ props }) => {
        const p = props as unknown as VideoProps;
        return p.aspect === "16:9" ? { width: 1280, height: 720 } : p.aspect === "1:1" ? { width: 1080, height: 1080 } : { width: 1080, height: 1920 };
      }}
    />
  </>
);

registerRoot(Root);
