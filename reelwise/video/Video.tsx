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

const SceneView: React.FC<{ p: VideoProps; i: number; bare?: boolean }> = ({ p, i, bare }) => {
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
        {bare ? null : <LowerThird heading={scene.heading} subheading={scene.subheading} brand={p.brand} />}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <PromoScene scene={scene} brand={p.brand} imageUrl={imageUrl} dur={dur} bare={bare} />
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

/** Cover / thumbnail: the chosen scene's frame with Claude's headline (or the thumbnail text). */
export const ReelwiseThumbnail: React.FC<VideoProps> = (p) => {
  const { width, height } = useVideoConfig();
  const k = Math.min(width, height) / 1080;
  const c = p.cover ?? null;
  const n = p.storyboard.scenes.length;
  const i = c ? Math.max(0, Math.min(n - 1, Math.round(c.sceneIndex))) : 0;
  const mid = Math.round(((p.sceneDurations[i] ?? 3) * FPS) / 2);
  const headline = (c?.headline || p.storyboard.thumbnailText || p.storyboard.title).trim();
  const accent = c && /^#[0-9a-f]{6}$/i.test(c.accentColor) ? c.accentColor : p.brand.colors[0];
  const hl = (c?.highlightWord ?? "").trim().toLowerCase();
  const layout = c?.layout ?? "bottom";
  const portrait = height > width;
  const size = (portrait ? 132 : 118) * k * (headline.length > 22 ? 0.78 : 1);
  const shade =
    layout === "top" ? "linear-gradient(0deg, transparent 40%, rgba(5,8,20,.8))"
    : layout === "center" ? "radial-gradient(ellipse at center, rgba(5,8,20,.7), rgba(5,8,20,.15) 70%)"
    : "linear-gradient(180deg, transparent 35%, rgba(5,8,20,.82))";
  return (
    <AbsoluteFill>
      <Sequence from={-mid}>
        <SceneView p={p} i={i} bare />
      </Sequence>
      <AbsoluteFill style={{ background: shade }} />
      <AbsoluteFill
        style={{
          justifyContent: layout === "top" ? "flex-start" : layout === "center" ? "center" : "flex-end",
          alignItems: layout === "center" ? "center" : "flex-start",
          textAlign: layout === "center" ? "center" : "left",
          padding: `${(layout === "top" ? 150 : 80) * k}px ${70 * k}px ${(portrait && layout === "bottom" ? 220 : 80) * k}px`,
        }}
      >
        <div style={{ fontFamily: p.brand.headingFont, fontWeight: 900, fontSize: size, lineHeight: 1.02, color: "#fff", textTransform: "uppercase", letterSpacing: -1 * k, textShadow: "0 10px 34px rgba(0,0,0,.65)", maxWidth: "100%" }}>
          {headline.split(/(\s+)/).map((w, j) =>
            hl && w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === hl.replace(/[^\p{L}\p{N}]/gu, "") ? (
              <span key={j} style={{ color: accent }}>{w}</span>
            ) : (
              <React.Fragment key={j}>{w}</React.Fragment>
            ),
          )}
        </div>
        {c?.subline ? (
          <div style={{ marginTop: 22 * k, display: "inline-block", padding: `${12 * k}px ${24 * k}px`, borderRadius: 14 * k, background: accent, color: "#fff", fontFamily: p.brand.bodyFont, fontWeight: 800, fontSize: 46 * k }}>{c.subline}</div>
        ) : (
          <div style={{ marginTop: 24 * k, width: 180 * k, height: 14 * k, borderRadius: 9, background: accent }} />
        )}
      </AbsoluteFill>
      <LogoBug brand={p.brand} />
    </AbsoluteFill>
  );
};
