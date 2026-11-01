import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { BrandKit, Cue } from "./types";
import { isDark } from "./anim";

const useK = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

/** Lower-third headline for 3D scenes. */
export const LowerThird: React.FC<{ heading: string; subheading: string; brand: BrandKit }> = ({ heading, subheading, brand }) => {
  const f = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const k = useK();
  const s = spring({ frame: f - 6, fps, config: { damping: 18 } });
  if (!heading) return null;
  const portrait = height > width;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: portrait ? "center" : "flex-start", padding: `${(portrait ? 190 : 70) * k}px ${70 * k}px` }}>
      <div style={{ transform: `translateY(${(1 - s) * -40}px)`, opacity: s, padding: `${22 * k}px ${34 * k}px`, borderRadius: 28 * k, background: "rgba(255,255,255,.86)", backdropFilter: "blur(10px)", boxShadow: "0 18px 40px rgba(10,15,40,.25)", maxWidth: width * 0.86, borderLeft: `${10 * k}px solid ${brand.colors[0]}` }}>
        <div style={{ fontFamily: brand.headingFont, fontWeight: 800, fontSize: 58 * k, color: "#141a33", lineHeight: 1.1 }}>{heading}</div>
        {subheading ? <div style={{ fontFamily: brand.bodyFont, fontSize: 32 * k, color: "#4a5070", marginTop: 8 * k }}>{subheading}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** Burned-in subtitles, positioned inside the Reels/Shorts safe area. */
export const Subtitles: React.FC<{ cues: Cue[]; brand: BrandKit }> = ({ cues, brand }) => {
  const f = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const k = useK();
  const t = f / fps;
  const cue = cues.find((c) => t >= c.from && t < c.to);
  if (!cue) return null;
  const pop = interpolate(t - cue.from, [0, 0.12], [0.9, 1], { extrapolateRight: "clamp" });
  const portrait = height > width;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: (portrait ? 420 : 90) * k }}>
      <div style={{ transform: `scale(${pop})`, maxWidth: width * 0.84, padding: `${14 * k}px ${26 * k}px`, borderRadius: 18 * k, background: "rgba(10,14,30,.72)", color: "#fff", fontFamily: brand.bodyFont, fontWeight: 700, fontSize: (portrait ? 50 : 44) * k, lineHeight: 1.25, textAlign: "center" }}>
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};

export const LogoBug: React.FC<{ brand: BrandKit }> = ({ brand }) => {
  const k = useK();
  if (!brand.logoUrl) return null;
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "flex-start", padding: 46 * k }}>
      <Img src={brand.logoUrl} style={{ height: 70 * k, objectFit: "contain", opacity: 0.9, filter: "drop-shadow(0 4px 10px rgba(0,0,0,.3))" }} />
    </AbsoluteFill>
  );
};

export const BrandCard: React.FC<{ brand: BrandKit; line: string; outro?: boolean }> = ({ brand, line, outro }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = useK();
  const s = spring({ frame: f, fps, config: { damping: 14 } });
  const [a, b] = brand.colors;
  const textColor = isDark(a) ? "#ffffff" : "#141a33";
  return (
    <AbsoluteFill style={{ background: `linear-gradient(135deg, ${a}, ${b})`, alignItems: "center", justifyContent: "center", gap: 36 * k, padding: 80 * k }}>
      <div style={{ transform: `scale(${0.7 + 0.3 * s})`, opacity: s, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 * k }}>
        {brand.logoUrl ? (
          <Img src={brand.logoUrl} style={{ height: 220 * k, objectFit: "contain", filter: "drop-shadow(0 18px 30px rgba(0,0,0,.25))" }} />
        ) : (
          <div style={{ fontFamily: brand.headingFont, fontWeight: 800, fontSize: 110 * k, color: textColor, textAlign: "center", lineHeight: 1.05 }}>{brand.name}</div>
        )}
        {line ? <div style={{ fontFamily: brand.bodyFont, fontWeight: 600, fontSize: 46 * k, color: textColor, textAlign: "center" }}>{line}</div> : null}
        {outro && (brand.website || brand.contact) ? (
          <div style={{ fontFamily: brand.bodyFont, fontSize: 34 * k, color: textColor, opacity: 0.9, textAlign: "center" }}>
            {[brand.website, brand.contact].filter(Boolean).join("  •  ")}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** Gentle cinematic grade applied over everything. */
export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 85% 80% at 50% 50%, transparent 60%, rgba(0,0,0,.28) 100%)" }} />
);
