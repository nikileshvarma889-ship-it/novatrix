import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../config";
import { TOOLS } from "../content/tools";
import { TechBackground } from "../components/TechBackground";
import { RingTunnel, WireCube } from "../components/Shapes3D";
import { Emblem, Wordmark } from "../components/Logo";
import { Subtitles } from "../components/Subtitles";
import { Voiceover } from "../components/Voiceover";
import { CategoryIcon } from "../components/Icons";
import { displayFont, bodyFont } from "../fonts";
import { SegmentTiming } from "../timeline";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

export const IntroScene: React.FC<{ timing: SegmentTiming }> = ({ timing }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const logoEnd = timing.voFrom;
  // The tool carousel appears with the "7 AI websites" sentence.
  const carouselAt = timing.sentences[3]?.from ?? Math.round(durationInFrames * 0.6);

  // --- Act 1: fly through the ring tunnel, logo assembles ---
  const travel = interpolate(frame, [0, logoEnd], [-600, 3600], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tunnelOpacity = interpolate(frame, [logoEnd - 20, logoEnd + 10], [1, 0.25], clamp);
  const logoIn = spring({ frame: frame - 20, fps, config: { damping: 18, mass: 1.2 } });
  const logoOut = interpolate(frame, [logoEnd - 12, logoEnd + 12], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const flash = interpolate(frame, [54, 57, 66], [0, 0.3, 0], clamp);

  // --- Act 2: title ---
  const titleWords = BRAND.title.split(" ");
  const titleUp = interpolate(frame, [carouselAt - 10, carouselAt + 15], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const sub = spring({ frame: frame - logoEnd - 22, fps, config: { damping: 200 } });
  const illegalGlitch = frame % 47 < 3 ? (frame % 2 ? 6 : -6) : 0;

  // --- Act 3: 3D carousel of the seven tools ---
  const carousel = spring({ frame: frame - carouselAt, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <TechBackground seed="intro" speed={frame < logoEnd ? 5 : 2} />
      <AbsoluteFill style={{ perspective: 1200 }}>
        <WireCube size={140} color={BRAND.secondary} x={260} y={300} z={-200} opacity={0.6} />
        <WireCube size={100} color={BRAND.primary} x={1680} y={760} z={-100} speed={-0.8} opacity={0.6} />
        <WireCube size={70} color={BRAND.hot} x={1560} y={230} z={-300} speed={1.4} opacity={0.5} />
      </AbsoluteFill>
      <RingTunnel colors={[BRAND.primary, BRAND.secondary, "#ffffff"]} travel={travel} opacity={tunnelOpacity} />

      {/* Logo */}
      {frame < logoEnd + 14 ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            transform: `translateY(${logoOut * -80}px) scale(${(0.6 + 0.4 * logoIn) * (1 - logoOut * 0.4)})`,
            opacity: 1 - logoOut,
          }}
        >
          <Emblem size={220} delay={10} />
          <div style={{ height: 36 }} />
          <Wordmark fontSize={130} delay={40} />
        </AbsoluteFill>
      ) : null}

      {/* Title */}
      {frame >= logoEnd ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            transform: `translateY(${titleUp * -300}px) scale(${1 - titleUp * 0.35})`,
          }}
        >
          <div style={{ display: "flex", gap: 34, alignItems: "baseline" }}>
            {titleWords.map((w, i) => {
              const s = spring({ frame: frame - logoEnd - i * 5, fps, config: { damping: 12, mass: 0.8 } });
              const isNum = i === 0;
              const isFree = w === "FREE";
              return (
                <span
                  key={i}
                  style={{
                    fontFamily: displayFont,
                    fontWeight: 700,
                    fontSize: isNum ? 230 : 170,
                    lineHeight: 1,
                    display: "inline-block",
                    transform: `translateY(${(1 - s) * 120}px) rotateX(${(1 - s) * 70}deg)`,
                    opacity: Math.min(1, s * 1.5),
                    color: isNum || isFree ? "transparent" : "#fff",
                    backgroundImage: isNum
                      ? `linear-gradient(180deg, #fff, ${BRAND.secondary})`
                      : isFree
                        ? `linear-gradient(90deg, ${BRAND.secondary}, ${BRAND.primary})`
                        : undefined,
                    WebkitBackgroundClip: isNum || isFree ? "text" : undefined,
                    backgroundClip: isNum || isFree ? "text" : undefined,
                    filter: `drop-shadow(0 0 30px ${BRAND.primary}88)`,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 26,
              fontFamily: displayFont,
              fontWeight: 500,
              fontSize: 64,
              color: "#dfe6ff",
              opacity: sub,
              transform: `translateY(${(1 - sub) * 30}px)`,
              letterSpacing: "0.01em",
            }}
          >
            That Feel{" "}
            <span
              style={{
                position: "relative",
                display: "inline-block",
                color: BRAND.hot,
                fontWeight: 700,
                transform: `translateX(${illegalGlitch}px)`,
                textShadow: illegalGlitch ? `-6px 0 ${BRAND.secondary}, 6px 0 ${BRAND.primary}` : `0 0 30px ${BRAND.hot}aa`,
              }}
            >
              ILLEGAL
            </span>{" "}
            to Know in 2026
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Carousel */}
      {frame >= carouselAt ? (
        <AbsoluteFill style={{ perspective: 1600, alignItems: "center", justifyContent: "center", opacity: carousel }}>
          <div
            style={{
              position: "relative",
              width: 250,
              height: 180,
              marginTop: 150,
              transformStyle: "preserve-3d",
              transform: `rotateX(-12deg) rotateY(${(frame - carouselAt) * -0.9}deg) scale(${0.6 + 0.25 * carousel})`,
            }}
          >
            {TOOLS.map((t, i) => (
              <div
                key={t.id}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 24,
                  background: `linear-gradient(160deg, ${t.accent}44, rgba(10,12,28,0.92) 60%)`,
                  border: `2px solid ${t.accent}`,
                  boxShadow: `0 0 40px ${t.accent}66`,
                  transform: `rotateY(${(i * 360) / TOOLS.length}deg) translateZ(520px)`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  backfaceVisibility: "hidden",
                }}
              >
                <CategoryIcon kind={t.demo} size={64} color={t.accent} />
                <div style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 38, color: "#fff" }}>{t.name}</div>
                <div style={{ fontFamily: bodyFont, fontSize: 18, color: "#c9d1f0" }}>#{t.number}</div>
              </div>
            ))}
          </div>
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
      <Subtitles cues={timing.cues} accent={BRAND.secondary} bottom={60} />
      <Voiceover timing={timing} />
    </AbsoluteFill>
  );
};
