import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TechBackground } from "../components/TechBackground";
import { BrowserFrame } from "../components/BrowserFrame";
import { Subtitles } from "../components/Subtitles";
import { ProgressRail } from "../components/ProgressRail";
import { Voiceover } from "../components/Voiceover";
import { CategoryIcon, CheckIcon } from "../components/Icons";
import { WireCube } from "../components/Shapes3D";
import { bodyFont, displayFont } from "../fonts";
import { SegmentTiming } from "../timeline";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export const ToolScene: React.FC<{ timing: SegmentTiming }> = ({ timing }) => {
  const tool = timing.tool!;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const a = tool.accent;

  // Big number slams in, then everything else follows.
  const numIn = spring({ frame, fps, config: { damping: 11, mass: 0.9 } });
  const nameIn = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const chipIn = spring({ frame: frame - 16, fps, config: { damping: 200 } });
  const frameIn = spring({ frame: frame - 10, fps, config: { damping: 20, mass: 1.1 } });

  // Slow camera drift around the browser window over the whole scene.
  const drift = interpolate(frame, [0, durationInFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const rotY = interpolate(frameIn, [0, 1], [45, -14]) + drift * 8;
  const rotX = 4 - drift * 3 + Math.sin(frame / 40) * 1;
  const floatY = Math.sin(frame / 28) * 10;

  // Feature bullets reveal as the narration progresses.
  const s = timing.sentences;
  const revealFrames: number[] = [];
  tool.features.forEach((_, i) => {
    const at = s[Math.min(s.length - 1, i + 1)]?.from ?? 30 + i * 30;
    // Scenes with fewer sentences than features: stagger the overflow.
    revealFrames.push(i > 0 && at <= revealFrames[i - 1] ? revealFrames[i - 1] + 18 : at);
  });

  const nameLetters = tool.name.split("");

  return (
    <AbsoluteFill>
      <TechBackground accent={a} accent2={tool.accent2} seed={tool.id} />
      <AbsoluteFill style={{ perspective: 1200 }}>
        <WireCube size={90} color={tool.accent2} x={1800} y={150} z={-250} opacity={0.45} />
        <WireCube size={60} color={a} x={90} y={960} z={-150} speed={-1} opacity={0.4} />
      </AbsoluteFill>

      <ProgressRail current={tool.number} accent={a} />

      {/* Left column */}
      <div style={{ position: "absolute", left: 110, top: 150, width: 720 }}>
        <div
          style={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: 240,
            lineHeight: 0.9,
            color: "transparent",
            WebkitTextStroke: `3px ${a}`,
            textShadow: `0 0 50px ${a}55`,
            transform: `scale(${interpolate(numIn, [0, 1], [2.2, 1])})`,
            transformOrigin: "left center",
            opacity: Math.min(1, numIn * 2),
          }}
        >
          {String(tool.number).padStart(2, "0")}
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginTop: 18,
            padding: "10px 20px",
            borderRadius: 999,
            background: `${a}22`,
            border: `1px solid ${a}88`,
            opacity: chipIn,
            transform: `translateX(${(1 - chipIn) * -40}px)`,
          }}
        >
          <CategoryIcon kind={tool.demo} size={30} color={a} />
          <span style={{ fontFamily: displayFont, fontWeight: 500, fontSize: 24, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {tool.category}
          </span>
        </div>

        <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap" }}>
          {nameLetters.map((l, i) => {
            const p = spring({ frame: frame - 8 - i * 2, fps, config: { damping: 14 } });
            return (
              <span
                key={i}
                style={{
                  fontFamily: displayFont,
                  fontWeight: 700,
                  fontSize: tool.name.length > 9 ? 108 : 124,
                  lineHeight: 1.05,
                  color: "#fff",
                  display: "inline-block",
                  whiteSpace: "pre",
                  transform: `translateY(${(1 - p) * 60}px)`,
                  opacity: p,
                  textShadow: `0 0 40px ${a}66`,
                }}
              >
                {l}
              </span>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 6,
            fontFamily: bodyFont,
            fontSize: 36,
            fontWeight: 600,
            color: tool.accent2,
            opacity: nameIn,
          }}
        >
          {tool.tagline}
        </div>

        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 18 }}>
          {tool.features.map((f, i) => {
            const p = spring({ frame: frame - revealFrames[i], fps, config: { damping: 16 } });
            return (
              <div
                key={f}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  opacity: p,
                  transform: `translateX(${(1 - p) * -60}px)`,
                  fontFamily: bodyFont,
                  fontSize: 32,
                  fontWeight: 600,
                  color: "#eef1ff",
                }}
              >
                <CheckIcon size={38} color={a} />
                {f}
              </div>
            );
          })}
        </div>
      </div>

      {/* Browser window with screen recording */}
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: "absolute",
            left: 860,
            top: 180,
            transform: `translateX(${(1 - frameIn) * 700}px) translateY(${floatY}px) rotateY(${rotY}deg) rotateX(${rotX}deg)`,
            transformOrigin: "30% 50%",
          }}
        >
          <BrowserFrame tool={tool} clip={timing.clip} width={960} height={600} />
          {/* Reflection */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 610,
              height: 80,
              borderRadius: 22,
              background: `linear-gradient(180deg, ${a}33, transparent)`,
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -24,
              top: -26,
              padding: "10px 18px",
              borderRadius: 12,
              background: "#16f2a0",
              color: "#03140d",
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "0.06em",
              boxShadow: "0 0 30px #16f2a088",
              transform: `rotate(6deg) scale(${spring({ frame: frame - 30, fps, config: { damping: 9 } })})`,
            }}
          >
            FREE PLAN
          </div>
        </div>
      </AbsoluteFill>

      <Subtitles cues={timing.cues} accent={a} bottom={56} />
      <Voiceover timing={timing} />
    </AbsoluteFill>
  );
};
