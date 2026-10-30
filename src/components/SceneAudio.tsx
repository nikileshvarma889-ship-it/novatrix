import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { AUDIO, VIDEO } from "../config";
import { SceneTiming } from "../engine/timeline";
import { findSfx } from "../engine/media";

/** Narration plus any sound effects cued in the scene's JSON. */
export const SceneAudio: React.FC<{ slug: string; timing: SceneTiming }> = ({ slug, timing }) => (
  <>
    {timing.voiceover ? (
      <Sequence from={timing.voFrom} durationInFrames={timing.voFrames} layout="none">
        <Audio src={staticFile(timing.voiceover)} volume={AUDIO.voiceoverVolume} />
      </Sequence>
    ) : null}
    {(timing.scene.sfx ?? []).map((cue, i) => {
      const sfx = findSfx(slug, cue.id);
      if (!sfx) return null;
      return (
        <Sequence
          key={`${cue.id}-${i}`}
          from={Math.round(cue.at * VIDEO.fps)}
          durationInFrames={Math.max(1, Math.ceil(sfx.duration * VIDEO.fps))}
          layout="none"
        >
          <Audio src={staticFile(sfx.file)} volume={AUDIO.sfxVolume * (cue.volume ?? 1)} />
        </Sequence>
      );
    })}
  </>
);
