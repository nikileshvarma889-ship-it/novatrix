import React from "react";
import { AbsoluteFill, Img, interpolate, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Asset, Motion } from "../engine/types";
import { projectMedia } from "../engine/media";
import { SHOW_PLACEHOLDER_SLATES, VIDEO } from "../config";
import { COLORS, FONTS } from "../brand/theme";
import { useFormat } from "../engine/format";
import { CinematicBackdrop } from "./CinematicBackdrop";
import { ProvenanceTag } from "./ProvenanceTag";

const motionTransform = (motion: Motion, p: number) => {
  const lerp = (a: number, b: number) => a + (b - a) * p;
  switch (motion) {
    case "push-in":
      return `scale(${lerp(1.04, 1.16)})`;
    case "pull-out":
      return `scale(${lerp(1.16, 1.04)})`;
    case "pan-left":
      return `scale(1.14) translateX(${lerp(3.5, -3.5)}%)`;
    case "pan-right":
      return `scale(1.14) translateX(${lerp(-3.5, 3.5)}%)`;
    case "rise":
      return `scale(1.14) translateY(${lerp(3, -3)}%)`;
    default:
      return `scale(${lerp(1.03, 1.06)})`;
  }
};

/**
 * Full-frame visual for a scene: the real photo or clip if it is in
 * public/projects/<slug>/footage/, otherwise a "footage needed" slate.
 * Applies slow camera motion and the provenance label.
 */
export const Footage: React.FC<{
  slug: string;
  assetId?: string;
  asset?: Asset;
  motion?: Motion;
  dim?: number;
  /** Small corner slate, for scenes that put their own text over the footage. */
  compactSlate?: boolean;
}> = ({ slug, assetId, asset, motion = "push-in", dim = 0.25, compactSlate = false }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { u, vertical } = useFormat();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const file = asset ? projectMedia(slug).footage[asset.file] : undefined;
  const focus = asset?.focus ?? [0.5, 0.5];
  const position = `${focus[0] * 100}% ${focus[1] * 100}%`;
  const media: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: position };

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: COLORS.black }}>
      {file ? (
        <AbsoluteFill style={{ transform: motionTransform(motion, p), transformOrigin: position }}>
          {file.type === "image" && vertical && asset?.fitVertical === "contain" ? (
            <>
              <Img src={staticFile(file.file)} style={{ ...media, filter: "blur(40px) brightness(0.35)", transform: "scale(1.2)" }} />
              <AbsoluteFill style={{ justifyContent: "center", marginTop: -240 * u }}>
                <Img src={staticFile(file.file)} style={{ width: "100%", height: "auto", boxShadow: "0 30px 80px rgba(0,0,0,0.7)" }} />
              </AbsoluteFill>
            </>
          ) : file.type === "image" ? (
            <Img src={staticFile(file.file)} style={media} />
          ) : (
            <Loop durationInFrames={Math.max(1, Math.floor((file.duration ?? 1) * VIDEO.fps))}>
              <OffthreadVideo src={staticFile(file.file)} muted style={media} />
            </Loop>
          )}
        </AbsoluteFill>
      ) : (
        <>
          <CinematicBackdrop seed={assetId ?? "slate"} light={0.8} />
          {SHOW_PLACEHOLDER_SLATES && asset && compactSlate ? (
            <div
              style={{
                position: "absolute",
                left: (vertical ? 60 : 64) * u,
                top: (vertical ? 150 : 48) * u,
                padding: `${8 * u}px ${14 * u}px`,
                border: `1px dashed ${COLORS.goldDeep}`,
                fontFamily: FONTS.sans,
                fontSize: (vertical ? 20 : 16) * u,
                color: COLORS.ash,
                letterSpacing: "0.06em",
              }}
            >
              <span style={{ color: COLORS.gold }}>FOOTAGE NEEDED</span> · {asset.file} — {asset.description}
            </div>
          ) : null}
          {SHOW_PLACEHOLDER_SLATES && asset && !compactSlate ? (
            <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 120 * u }}>
              <div
                style={{
                  maxWidth: (vertical ? 860 : 1100) * u,
                  marginTop: vertical ? -300 * u : -120 * u,
                  padding: `${28 * u}px ${40 * u}px`,
                  border: `1px solid ${COLORS.goldDeep}`,
                  textAlign: "center",
                  fontFamily: FONTS.sans,
                  color: COLORS.ash,
                  fontSize: 20 * u,
                  lineHeight: 1.5,
                  background: "rgba(0,0,0,0.35)",
                }}
              >
                <div style={{ color: COLORS.gold, letterSpacing: "0.3em", fontWeight: 600, fontSize: 16 * u, marginBottom: 10 * u }}>
                  FOOTAGE NEEDED · {asset.kind.toUpperCase()}
                </div>
                <div style={{ fontFamily: FONTS.serif, fontStyle: "italic", fontSize: 34 * u, color: COLORS.bone, lineHeight: 1.25 }}>
                  {asset.description}
                </div>
                <div style={{ marginTop: 12 * u }}>public/projects/{slug}/footage/{asset.file}</div>
              </div>
            </AbsoluteFill>
          ) : null}
        </>
      )}
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />
      {/* Keeps labels and captions legible over bright images. */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent ${vertical ? 14 : 20}%)` }} />
      {asset && file ? <ProvenanceTag asset={asset} /> : null}
    </AbsoluteFill>
  );
};
