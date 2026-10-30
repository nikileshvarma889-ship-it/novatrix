import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { AUDIO } from "../config";
import { SegmentTiming } from "../timeline";

export const Voiceover: React.FC<{ timing: SegmentTiming }> = ({ timing }) =>
  timing.voiceover ? (
    <Sequence from={timing.voFrom} durationInFrames={timing.voFrames} layout="none">
      <Audio src={staticFile(timing.voiceover)} volume={AUDIO.voiceoverVolume} />
    </Sequence>
  ) : null;
