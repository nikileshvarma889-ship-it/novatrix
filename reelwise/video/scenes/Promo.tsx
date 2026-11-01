import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "../../src/lib/ai/schemas";
import type { BrandKit } from "../types";
import { clamp, isDark, rand } from "../anim";

/** Animated brand-coloured backdrop: drifting soft light blobs + fine grain. */
export const BrandBackdrop: React.FC<{ brand: BrandKit; mood: string }> = ({ brand, mood }) => {
  const f = useCurrentFrame();
  const [a, b, dark] = brand.colors;
  const light = mood === "bright" || mood === "calm";
  const base = light ? "#f6f7ff" : dark || "#0f172a";
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      {[a, b, a].map((c, i) => {
        const x = 50 + Math.sin(f / (70 + i * 20) + i * 2) * 30;
        const y = 40 + Math.cos(f / (90 + i * 15) + i) * 25;
        return (
          <AbsoluteFill
            key={i}
            style={{ background: `radial-gradient(circle at ${x}% ${y}%, ${c}${light ? "55" : "70"} 0%, transparent ${45 + i * 8}%)` }}
          />
        );
      })}
      <AbsoluteFill style={{ background: `linear-gradient(160deg, transparent 40%, ${light ? "#ffffff66" : "#00000055"})` }} />
    </AbsoluteFill>
  );
};

const useScale = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

const Rise: React.FC<{ delay: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay, children, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 18, mass: 0.9 } });
  return <div style={{ transform: `translateY(${(1 - s) * 60}px)`, opacity: s, ...style }}>{children}</div>;
};

/** Word-by-word headline reveal. */
export const Headline: React.FC<{ text: string; size: number; color: string; font: string; delay?: number; align?: "center" | "left" }> = ({ text, size, color, font, delay = 0, align = "center" }) => (
  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", gap: `0 ${size * 0.28}px`, textAlign: align }}>
    {text.split(" ").map((w, i) => (
      <Rise key={i} delay={delay + i * 3}>
        <span style={{ fontFamily: font, fontWeight: 800, fontSize: size, lineHeight: 1.08, color, letterSpacing: "-0.02em" }}>{w}</span>
      </Rise>
    ))}
  </div>
);

export const PromoScene: React.FC<{ scene: Scene; brand: BrandKit; imageUrl: string | null; dur: number }> = ({ scene, brand, imageUrl }) => {
  const f = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const k = useScale();
  const portrait = height > width;
  const light = scene.mood === "bright" || scene.mood === "calm";
  const text = light ? "#141a33" : "#ffffff";
  const accent = brand.colors[0];
  const accentText = isDark(accent) ? "#ffffff" : "#141a33";
  const kb = interpolate(f, [0, durationInFrames], [1.04, 1.16]);
  const head = <Headline text={scene.heading} size={92 * k} color={text} font={brand.headingFont} />;
  const sub = scene.subheading ? (
    <Rise delay={12}>
      <div style={{ fontFamily: brand.bodyFont, fontSize: 40 * k, color: text, opacity: 0.8, marginTop: 24 * k, textAlign: "center", maxWidth: width * 0.8 }}>{scene.subheading}</div>
    </Rise>
  ) : null;

  const imageCard = (size: number) =>
    imageUrl ? (
      <Rise delay={4}>
        <div style={{ width: size, height: size, borderRadius: 40 * k, overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,.35)" }}>
          <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kb})` }} />
        </div>
      </Rise>
    ) : null;

  let body: React.ReactNode;
  switch (scene.kind) {
    case "text_image":
      body = (
        <AbsoluteFill style={{ flexDirection: portrait ? "column" : "row", alignItems: "center", justifyContent: "center", gap: 60 * k, padding: 80 * k }}>
          {imageCard(portrait ? width * 0.78 : height * 0.62)}
          <div style={{ maxWidth: portrait ? width * 0.85 : width * 0.42 }}>
            <Headline text={scene.heading} size={80 * k} color={text} font={brand.headingFont} align={portrait ? "center" : "left"} />
            {scene.subheading ? (
              <Rise delay={14}>
                <div style={{ fontFamily: brand.bodyFont, fontSize: 38 * k, color: text, opacity: 0.8, marginTop: 20 * k, textAlign: portrait ? "center" : "left" }}>{scene.subheading}</div>
              </Rise>
            ) : null}
          </div>
        </AbsoluteFill>
      );
      break;
    case "bullets":
      body = (
        <AbsoluteFill style={{ justifyContent: "center", padding: `0 ${90 * k}px` }}>
          <Headline text={scene.heading} size={80 * k} color={text} font={brand.headingFont} align="left" />
          <div style={{ marginTop: 50 * k, display: "flex", flexDirection: "column", gap: 28 * k }}>
            {scene.bullets.slice(0, 4).map((b, i) => (
              <Rise key={i} delay={14 + i * 10}>
                <div style={{ display: "flex", alignItems: "center", gap: 24 * k, padding: `${22 * k}px ${30 * k}px`, borderRadius: 26 * k, background: light ? "#ffffffcc" : "#ffffff18", fontFamily: brand.bodyFont, fontSize: 42 * k, color: text, fontWeight: 600 }}>
                  <span style={{ width: 54 * k, height: 54 * k, flex: "none", borderRadius: 999, background: accent, color: accentText, display: "grid", placeItems: "center", fontSize: 30 * k }}>✓</span>
                  {b}
                </div>
              </Rise>
            ))}
          </div>
        </AbsoluteFill>
      );
      break;
    case "product": {
      const s = spring({ frame: f, fps, config: { damping: 14 } });
      body = (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 50 * k }}>
          <div style={{ position: "relative", width: width * (portrait ? 0.8 : 0.42), aspectRatio: "1", display: "grid", placeItems: "center" }}>
            <div style={{ position: "absolute", inset: "8%", borderRadius: 999, background: `radial-gradient(circle, ${accent}88, transparent 70%)`, transform: `scale(${0.8 + 0.2 * Math.sin(f / 20)})` }} />
            <div style={{ position: "absolute", inset: 0, background: `conic-gradient(from ${f}deg, transparent, ${accent}33, transparent 30%)`, borderRadius: 999 }} />
            {imageUrl ? <Img src={imageUrl} style={{ width: "78%", height: "78%", objectFit: "contain", transform: `scale(${s}) translateY(${Math.sin(f / 18) * 10}px)`, filter: "drop-shadow(0 40px 50px rgba(0,0,0,.35))" }} /> : null}
          </div>
          <div style={{ maxWidth: width * 0.85 }}>{head}</div>
        </AbsoluteFill>
      );
      break;
    }
    case "stat": {
      const m = scene.heading.match(/[\d,.]+/);
      const n = m ? parseFloat(m[0].replace(/,/g, "")) : null;
      const shown = n !== null ? scene.heading.replace(m![0], Math.round(n * clamp(f / (fps * 1.2))).toLocaleString()) : scene.heading;
      body = (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 * k }}>
          <div style={{ fontFamily: brand.headingFont, fontWeight: 800, fontSize: 150 * k, color: accent, textAlign: "center", lineHeight: 1 }}>{shown}</div>
          {sub}
        </AbsoluteFill>
      );
      break;
    }
    case "quote":
      body = (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 100 * k }}>
          <div style={{ fontFamily: brand.headingFont, fontSize: 220 * k, color: accent, lineHeight: 0.6, height: 120 * k }}>“</div>
          <Headline text={scene.heading} size={72 * k} color={text} font={brand.headingFont} />
          {sub}
        </AbsoluteFill>
      );
      break;
    case "cta": {
      const pulse = 1 + Math.sin(f / 6) * 0.03;
      body = (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 * k, gap: 40 * k }}>
          {brand.logoUrl ? <Img src={brand.logoUrl} style={{ height: 150 * k, objectFit: "contain" }} /> : null}
          {head}
          <Rise delay={16}>
            <div style={{ transform: `scale(${pulse})`, padding: `${26 * k}px ${56 * k}px`, borderRadius: 999, background: accent, color: accentText, fontFamily: brand.bodyFont, fontWeight: 700, fontSize: 44 * k, boxShadow: `0 20px 50px ${accent}66` }}>
              {scene.subheading || brand.cta || "Learn more"}
            </div>
          </Rise>
          {brand.website ? <Rise delay={24}><div style={{ fontFamily: brand.bodyFont, fontSize: 36 * k, color: text, opacity: 0.85 }}>{brand.website}</div></Rise> : null}
        </AbsoluteFill>
      );
      break;
    }
    default:
      body = (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 90 * k }}>
          {imageUrl ? <AbsoluteFill style={{ opacity: 0.25 }}><Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kb})` }} /></AbsoluteFill> : null}
          {head}
          {sub}
        </AbsoluteFill>
      );
  }
  return (
    <AbsoluteFill>
      <BrandBackdrop brand={brand} mood={scene.mood} />
      {body}
    </AbsoluteFill>
  );
};

/** Floating particles used across promo scenes for depth. */
export const Sparkles: React.FC<{ color: string }> = ({ color }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 24 }).map((_, i) => {
        const x = rand(i) * width;
        const y = (rand(i + 7) * height - f * (0.5 + rand(i + 3))) % height;
        return <div key={i} style={{ position: "absolute", left: x, top: (y + height) % height, width: 6, height: 6, borderRadius: 9, background: color, opacity: 0.35 + 0.35 * Math.sin(f / 15 + i) }} />;
      })}
    </AbsoluteFill>
  );
};
