import React from "react";
import { Composition, Still } from "remotion";
import { VIDEO } from "./config";
import { NovatrixVideo } from "./Video";
import { Thumbnail } from "./Thumbnail";
import { TOTAL_FRAMES } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id={VIDEO.id}
      component={NovatrixVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
    <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} />
  </>
);
