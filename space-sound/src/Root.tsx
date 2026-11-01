import React from "react";
import { Composition, Still, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import { SpaceSound } from "./Reel";
import { Cover } from "./Cover";
import timeline from "./timeline.json";

loadFont({ family: "Noto Sans Telugu", url: staticFile("NotoSansTelugu-700.woff2"), weight: "700" });
loadFont({ family: "Noto Sans Telugu", url: staticFile("NotoSansTelugu-500.woff2"), weight: "500" });

export const Root: React.FC = () => (
  <>
    <Composition id="SpaceSound" component={SpaceSound} durationInFrames={Math.round(timeline.duration * 30)} fps={30} width={1080} height={1920} />
    <Still id="Cover" component={Cover} width={1080} height={1920} />
  </>
);
