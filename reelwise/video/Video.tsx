import React from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import type { VideoProps } from "./types";
import { FPS } from "./types";
import { PromoScene, Sparkles } from "./scenes/Promo";
import { SCENES_3D } from "./three/Scenes3D";
import { BrandCard, Grade, LogoBug, LowerThird, Subtitles } from "./Overlays";

const T = 12; // transition frames

const SceneView: React.FC<{ p: VideoProps; i: number }> = ({ p, i }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = p.storyboard.scenes[i];
  const dur = p.sceneDurations[i];
  const imageUrl = scene.imageMediaId ? p.media[scene.imageMediaId] ?? null : null;
  const Comp3D = (SCENES_3D as Record<string, React.FC<any>>)[scene.kind];
  if (Comp3D) {
    return (
      <AbsoluteFill>
        <Comp3D t={f / fps} dur={dur} mood={scene.mood} accent={p.brand.colors[0]} accent2={p.brand.colors[1]} camera={scene.camera} characterColor={scene.characterColor} imageUrl={imageUrl} fromPlace={scene.fromPlace} toPlace={scene.toPlace} />
        <LowerThird heading={scene.heading} subheading={scene.subheading} brand={p.brand} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <PromoScene scene={scene} brand={p.brand} imageUrl={imageUrl} dur={dur} />
      <Sparkles color={p.brand.colors[1]} />
    </AbsoluteFill>
  );
};

export const totalFrames = (p: Pick<VideoProps, "sceneDurations" | "introSec" | "outroSec">) => {
  const parts = [p.introSec, ...p.sceneDurations, p.outroSec].filter((s) => s > 0);
  return Math.round(parts.reduce((a, b) => a + b, 0) * FPS) - T * (parts.length - 1);
};

export const ReelwiseVideo: React.FC<VideoProps> = (p) => {
  const segments: { key: string; frames: number; node: React.ReactNode }[] = [];
  if (p.introSec > 0) segments.push({ key: "intro", frames: Math.round(p.introSec * FPS), node: <BrandCard brand={p.brand} line={p.brand.introText} /> });
  p.storyboard.scenes.forEach((s, i) => segments.push({ key: s.id + i, frames: Math.round(p.sceneDurations[i] * FPS), node: <SceneView p={p} i={i} /> }));
  if (p.outroSec > 0) segments.push({ key: "outro", frames: Math.round(p.outroSec * FPS), node: <BrandCard brand={p.brand} line={p.brand.outroText || p.brand.cta} outro /> });
  return (
    <AbsoluteFill style={{ background: "#000", filter: "contrast(1.05) saturate(1.06)" }}>
      <TransitionSeries>
        {segments.map((s, i) => (
          <React.Fragment key={s.key}>
            <TransitionSeries.Sequence durationInFrames={s.frames}>{s.node}</TransitionSeries.Sequence>
            {i < segments.length - 1 ? (
              <TransitionSeries.Transition presentation={i % 3 === 1 ? slide({ direction: "from-right" }) : fade()} timing={linearTiming({ durationInFrames: T })} />
            ) : null}
          </React.Fragment>
        ))}
      </TransitionSeries>
      <LogoBug brand={p.brand} />
      <Subtitles cues={p.cues} brand={p.brand} />
      <Grade />
      {p.voiceoverUrl ? <Audio src={p.voiceoverUrl} /> : null}
      {p.musicUrl ? <Audio src={p.musicUrl} loop volume={(f) => (p.voiceoverUrl ? p.musicVolume * 0.45 : p.musicVolume) * Math.min(1, f / 30)} /> : null}
      {p.sfxUrl
        ? segments.slice(1).map((s, i) => {
            const start = segments.slice(0, i + 1).reduce((a, x) => a + x.frames, 0) - T * (i + 1);
            return (
              <Sequence key={s.key} from={Math.max(0, start - 4)} durationInFrames={24}>
                <Audio src={p.sfxUrl!} volume={0.35} />
              </Sequence>
            );
          })
        : null}
    </AbsoluteFill>
  );
};

/** Thumbnail: first scene's visual with the thumbnail text. */
export const ReelwiseThumbnail: React.FC<VideoProps> = (p) => {
  const { width, height } = useVideoConfig();
  const k = Math.min(width, height) / 1080;
  const text = p.storyboard.thumbnailText || p.storyboard.title;
  return (
    <AbsoluteFill>
      <Sequence from={-45}>
        <SceneView p={p} i={0} />
      </Sequence>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 30%, rgba(5,8,20,.75))" }} />
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: 70 * k }}>
        <div style={{ fontFamily: p.brand.headingFont, fontWeight: 900, fontSize: 120 * k, lineHeight: 1, color: "#fff", textTransform: "uppercase", textShadow: "0 8px 30px rgba(0,0,0,.6)" }}>{text}</div>
        <div style={{ marginTop: 24 * k, width: 180 * k, height: 14 * k, borderRadius: 9, background: p.brand.colors[0] }} />
      </AbsoluteFill>
      <LogoBug brand={p.brand} />
    </AbsoluteFill>
  );
};
