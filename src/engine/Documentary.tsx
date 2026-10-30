import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { AUDIO, VIDEO } from "../config";
import { COLORS } from "../brand/theme";
import { ensureFonts } from "../fonts";
import { PROJECTS } from "../projects";
import { SceneRenderer } from "../scenes/SceneRenderer";
import { findMusic } from "./media";
import { buildCut, CutTiming, Span } from "./timeline";
import { presentationFor } from "./transitions";

ensureFonts();

export type DocumentaryProps = { slug: string; cutId: string };

export const getCut = (slug: string, cutId: string) => {
  const bundle = PROJECTS.find((p) => p.project.slug === slug);
  const cut = bundle?.cuts.find((c) => c.id === cutId);
  if (!bundle || !cut) throw new Error(`Unknown project/cut: ${slug}/${cutId}`);
  return { bundle, cut, timing: buildCut(bundle.project, cut) };
};

/** Background music, faded in/out and ducked under narration. */
const Music: React.FC<{ file: string; duration: number; timing: CutTiming }> = ({ file, duration, timing }) => {
  const fps = VIDEO.fps;
  const total = timing.totalFrames;
  const duck = 10;
  const volume = (f: number) => {
    let speaking = 0;
    for (const r of timing.narrationRanges as Span[]) {
      speaking = Math.max(
        speaking,
        interpolate(f, [r.from - duck, r.from, r.to, r.to + duck * 2], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      );
    }
    const level = interpolate(speaking, [0, 1], [AUDIO.musicVolumeNoVoice, AUDIO.musicVolumeUnderVoice]);
    const fadeIn = interpolate(f, [0, AUDIO.musicFadeInSeconds * fps], [0, 1], { extrapolateRight: "clamp" });
    const fadeOut = interpolate(f, [total - AUDIO.musicFadeOutSeconds * fps, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return level * fadeIn * fadeOut;
  };
  // Loop by stacking copies instead of <Audio loop>: a looping Audio restarts
  // the frame passed to `volume`, which would desync ducking and the fade-out.
  const length = Math.max(1, Math.floor(duration * fps));
  return (
    <>
      {new Array(Math.ceil(total / length)).fill(0).map((_, i) => (
        <Sequence key={i} from={i * length} durationInFrames={length} layout="none">
          <Audio src={staticFile(file)} volume={(f) => volume(i * length + f)} />
        </Sequence>
      ))}
    </>
  );
};

export const Documentary: React.FC<DocumentaryProps> = ({ slug, cutId }) => {
  const { bundle, cut, timing } = getCut(slug, cutId);
  const music = findMusic(slug, cut.music);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <TransitionSeries>
        {timing.scenes.map((t, i) => {
          const presentation = presentationFor(t.scene.transition ?? "fade");
          return (
            <React.Fragment key={t.scene.id}>
              <TransitionSeries.Sequence durationInFrames={t.durationInFrames}>
                <SceneRenderer slug={slug} timing={t} assets={bundle.assets} />
              </TransitionSeries.Sequence>
              {i < timing.scenes.length - 1 && presentation && t.transitionFrames > 0 ? (
                <TransitionSeries.Transition presentation={presentation} timing={linearTiming({ durationInFrames: t.transitionFrames })} />
              ) : null}
            </React.Fragment>
          );
        })}
      </TransitionSeries>
      {music ? <Music file={music.file} duration={music.duration} timing={timing} /> : null}
    </AbsoluteFill>
  );
};
