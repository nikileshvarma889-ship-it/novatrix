import React from "react";
import { Composition, Still } from "remotion";
import { LittleAnimalParade } from "./Parade";
import { Thumbnail } from "./Thumbnail";
import song from "./song.json";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="LittleAnimalParade" component={LittleAnimalParade} durationInFrames={song.lengthSeconds * 30} fps={30} width={1920} height={1080} />
    <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} />
  </>
);
