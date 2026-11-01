import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { Canvas3D, EarthScene, HookScene, NoReachScene, VisorScene, WaveScene } from "./Scenes";
import { Subtitles } from "./Subtitles";

const S = timeline.scenes;
const XF = 0.4; // crossfade seconds

/** Cinematic finish: vignette, gentle film grain, deep-blue/gold grade. */
const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,2,10,0.55) 100%)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(4,10,30,0.35) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.45) 100%)" }} />
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.07, mixBlendMode: "overlay" }}>
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(random(frame) * 1000)} /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
    </AbsoluteFill>
  );
};

const Shot: React.FC<{ from: number; to: number; children: (t: number) => React.ReactNode; first?: boolean; last?: boolean }> = ({ from, to, children, first, last }) => {
  const { fps } = useVideoConfig();
  const start = Math.max(0, from - (first ? 0 : XF));
  const end = last ? timeline.duration : to;
  return (
    <Sequence from={Math.round(start * fps)} durationInFrames={Math.round((end - start) * fps)} name={`${from}`}>
      <ShotBody start={start} from={from} first={first} last={last} end={end}>{children}</ShotBody>
    </Sequence>
  );
};
const ShotBody: React.FC<{ start: number; from: number; end: number; first?: boolean; last?: boolean; children: (t: number) => React.ReactNode }> = ({ start, from, end, first, last, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const abs = start + frame / fps;
  const fadeIn = first ? interpolate(abs, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }) : interpolate(abs, [start, from], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const fadeOut = last ? interpolate(abs, [end - 0.8, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>{children(abs - from)}</AbsoluteFill>;
};

export const SpaceSound: React.FC = () => {
  const boom = timeline.explosion;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Shot from={S.hook} to={S.orbit} first>{(t) => <Canvas3D><HookScene t={t} boomT={t - boom} /></Canvas3D>}</Shot>
      <Shot from={S.orbit} to={S.visor}>{(t) => <Canvas3D><HookScene t={t} boomT={t + S.orbit - boom} orbit /></Canvas3D>}</Shot>
      <Shot from={S.visor} to={S.air}>{(t) => <Canvas3D><VisorScene t={t} boomT={t + S.visor - boom} /></Canvas3D>}</Shot>
      <Shot from={S.air} to={S.vacuum}>{(t) => <Canvas3D><WaveScene t={t} mode="air" /></Canvas3D>}</Shot>
      <Shot from={S.vacuum} to={S.noreach}>{(t) => <Canvas3D><WaveScene t={t} mode="vacuum" /></Canvas3D>}</Shot>
      <Shot from={S.noreach} to={S.earth}>{(t) => <Canvas3D><NoReachScene t={t} /></Canvas3D>}</Shot>
      <Shot from={S.earth} to={timeline.duration} last>{(t) => <Canvas3D><EarthScene t={t} len={timeline.duration - S.earth} /></Canvas3D>}</Shot>
      <Grade />
      <Subtitles />
      <Audio src={staticFile("audio/mix.wav")} />
    </AbsoluteFill>
  );
};
