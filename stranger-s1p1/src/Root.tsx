import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import timeline from "./timeline.json";
import { SCENES, SceneShot } from "./SceneShot";

loadFont({ family: "Inter", url: staticFile("fonts/Inter-SemiBold.otf"), weight: "600" });
loadFont({ family: "Inter", url: staticFile("fonts/Inter-Bold.otf"), weight: "700" });
loadFont({ family: "Liberation Mono", url: staticFile("fonts/LiberationMono-Bold.ttf"), weight: "700" });

const FPS = 30;
const frames = (s: number) => Math.round(s * FPS);

/** Whole film with the master soundtrack (studio preview; the final MP4 is assembled from scene files). */
const Full: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {SCENES.map((s) => (
      <Sequence key={s.id} from={frames(s.start)} durationInFrames={frames(s.dur)} name={`${s.id} ${s.name}`}>
        <SceneShot id={s.id} />
      </Sequence>
    ))}
    <Audio src={staticFile("audio/mix.wav")} />
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition id="Full" component={Full} durationInFrames={frames(timeline.duration)} fps={FPS} width={1080} height={1920} />
    {SCENES.map((s) => (
      <Composition key={s.id} id={`Scene-${s.id}`} component={SceneShot} defaultProps={{ id: s.id }} durationInFrames={frames(s.dur)} fps={FPS} width={1080} height={1920} />
    ))}
  </>
);
