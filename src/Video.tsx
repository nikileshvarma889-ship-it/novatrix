import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { linearTiming, TransitionPresentation, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { AUDIO, BRAND, TIMING, VIDEO } from "./config";
import { MEDIA } from "./media";
import { NARRATION_RANGES, SEGMENT_STARTS, SegmentTiming, TIMELINE, TOTAL_FRAMES } from "./timeline";
import { IntroScene } from "./scenes/IntroScene";
import { ToolScene } from "./scenes/ToolScene";
import { OutroScene } from "./scenes/OutroScene";
import { ensureFonts } from "./fonts";

ensureFonts();

const Scene: React.FC<{ timing: SegmentTiming }> = ({ timing }) => {
  if (timing.kind === "intro") return <IntroScene timing={timing} />;
  if (timing.kind === "outro") return <OutroScene timing={timing} />;
  return <ToolScene timing={timing} />;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const presentations: TransitionPresentation<any>[] = [
  fade(),
  slide({ direction: "from-right" }),
  wipe({ direction: "from-left" }),
  slide({ direction: "from-bottom" }),
  wipe({ direction: "from-top-right" }),
  slide({ direction: "from-left" }),
  wipe({ direction: "from-bottom-left" }),
  slide({ direction: "from-right" }),
  fade(),
];

/** Bright light-streak that hides the seam of each transition. */
const TransitionFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const T = TIMING.transitionFrames;
  let o = 0;
  for (let i = 1; i < SEGMENT_STARTS.length; i++) {
    const mid = SEGMENT_STARTS[i] + T / 2;
    o = Math.max(o, interpolate(frame, [mid - T / 2, mid, mid + T / 2], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  }
  if (o <= 0) return null;
  const x = interpolate(o, [0, 1], [-30, 50]);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        mixBlendMode: "screen",
        background: `linear-gradient(105deg, transparent ${x}%, ${BRAND.secondary}55 ${x + 15}%, #ffffffaa ${x + 22}%, ${BRAND.primary}55 ${x + 30}%, transparent ${x + 45}%)`,
        opacity: o,
      }}
    />
  );
};

/** Background music, looped, faded, and ducked under the narration. */
const BackgroundMusic: React.FC = () => {
  if (!MEDIA.music) return null;
  const fps = VIDEO.fps;
  const duck = 8; // frames to glide between levels
  const volume = (f: number) => {
    let speaking = 0;
    for (const r of NARRATION_RANGES) {
      speaking = Math.max(
        speaking,
        interpolate(f, [r.from - duck, r.from, r.to, r.to + duck * 2], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      );
    }
    const level = interpolate(speaking, [0, 1], [AUDIO.musicVolumeNoVoice, AUDIO.musicVolumeUnderVoice]);
    const fadeIn = interpolate(f, [0, AUDIO.musicFadeInSeconds * fps], [0, 1], { extrapolateRight: "clamp" });
    const fadeOut = interpolate(f, [TOTAL_FRAMES - AUDIO.musicFadeOutSeconds * fps, TOTAL_FRAMES], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return level * fadeIn * fadeOut;
  };
  // Loop by stacking copies instead of <Audio loop>: a looping Audio restarts
  // the frame passed to `volume`, which would desync ducking and the fade-out.
  const src = staticFile(MEDIA.music.file);
  const length = Math.max(1, Math.floor(MEDIA.music.duration * fps));
  return (
    <>
      {new Array(Math.ceil(TOTAL_FRAMES / length)).fill(0).map((_, i) => (
        <Sequence key={i} from={i * length} durationInFrames={length} layout="none">
          <Audio src={src} volume={(f) => volume(i * length + f)} />
        </Sequence>
      ))}
    </>
  );
};

/** Optional whoosh on every transition (public/sfx/whoosh.mp3). */
const TransitionSfx: React.FC = () => {
  const whoosh = MEDIA.sfx.whoosh;
  if (!whoosh) return null;
  return (
    <>
      {SEGMENT_STARTS.slice(1).map((start) => (
        <Sequence key={start} from={Math.max(0, start - 6)} durationInFrames={Math.ceil(whoosh.duration * VIDEO.fps)} layout="none">
          <Audio src={staticFile(whoosh.file)} volume={AUDIO.sfxVolume} />
        </Sequence>
      ))}
    </>
  );
};

export const NovatrixVideo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: BRAND.bg }}>
    <TransitionSeries>
      {TIMELINE.map((timing, i) => (
        <React.Fragment key={timing.id}>
          <TransitionSeries.Sequence durationInFrames={timing.durationInFrames}>
            <Scene timing={timing} />
          </TransitionSeries.Sequence>
          {i < TIMELINE.length - 1 ? (
            <TransitionSeries.Transition
              presentation={presentations[i % presentations.length]}
              timing={linearTiming({ durationInFrames: TIMING.transitionFrames })}
            />
          ) : null}
        </React.Fragment>
      ))}
    </TransitionSeries>
    <TransitionFlash />
    <BackgroundMusic />
    <TransitionSfx />
  </AbsoluteFill>
);
