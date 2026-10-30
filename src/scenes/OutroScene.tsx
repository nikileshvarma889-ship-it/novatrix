import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../config";
import { TechBackground } from "../components/TechBackground";
import { RingTunnel, WireCube } from "../components/Shapes3D";
import { Emblem, Wordmark } from "../components/Logo";
import { Subtitles } from "../components/Subtitles";
import { Voiceover } from "../components/Voiceover";
import { BellIcon, CommentIcon, CursorIcon, ThumbIcon } from "../components/Icons";
import { bodyFont, displayFont } from "../fonts";
import { SegmentTiming } from "../timeline";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const phase = (frame: number, from: number, to: number, fade = 12) =>
  Math.min(
    interpolate(frame, [from, from + fade], [0, 1], clamp),
    interpolate(frame, [to - fade, to], [1, 0], clamp),
  );

export const OutroScene: React.FC<{ timing: SegmentTiming }> = ({ timing }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = timing.sentences;
  const at = (i: number, fallback: number) => s[i]?.from ?? fallback;

  const quoteAt = at(2, 150);
  const quote2At = at(3, quoteAt + 60);
  const subscribeAt = at(4, quote2At + 60);
  const endAt = at(5, subscribeAt + 150);
  const lastLineEnd = s[s.length - 1]?.to ?? endAt + 60;

  // Phase A: question
  const pA = phase(frame, 0, quoteAt);
  const qIn = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const bubble = spring({ frame: frame - at(1, 60), fps, config: { damping: 10 } });

  // Phase B: quote
  const pB = phase(frame, quoteAt, subscribeAt);
  const q1 = spring({ frame: frame - quoteAt, fps, config: { damping: 200 } });
  const q2 = spring({ frame: frame - quote2At, fps, config: { damping: 200 } });

  // Phase C: like + subscribe + bell with a cursor click
  const pC = phase(frame, subscribeAt, endAt);
  const likeAt = subscribeAt + 8;
  const clickAt = subscribeAt + 45;
  const bellAt = subscribeAt + 75;
  const like = spring({ frame: frame - likeAt, fps, config: { damping: 8 } });
  const btnIn = spring({ frame: frame - subscribeAt, fps, config: { damping: 14 } });
  const subscribed = frame >= clickAt;
  const press = interpolate(frame, [clickAt - 4, clickAt, clickAt + 6], [1, 0.9, 1], clamp);
  const cursorX = interpolate(frame, [subscribeAt + 10, clickAt - 4], [1500, 1010], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const cursorY = interpolate(frame, [subscribeAt + 10, clickAt - 4], [950, 610], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const ring = frame >= bellAt ? Math.sin((frame - bellAt) / 1.6) * 22 * Math.max(0, 1 - (frame - bellAt) / 40) : 0;
  const bellIn = spring({ frame: frame - bellAt, fps, config: { damping: 10 } });

  // Phase D: end screen (leave space for YouTube end-screen elements)
  const pD = interpolate(frame, [endAt, endAt + 15], [0, 1], clamp);
  const endFade = interpolate(frame, [durationInFrames - 20, durationInFrames - 1], [1, 0], clamp);
  const travel = interpolate(frame, [endAt, durationInFrames], [0, 1800], clamp);

  return (
    <AbsoluteFill>
      <TechBackground seed="outro" />
      <AbsoluteFill style={{ perspective: 1200 }}>
        <WireCube size={120} color={BRAND.secondary} x={200} y={260} z={-200} opacity={0.5} />
        <WireCube size={90} color={BRAND.primary} x={1720} y={820} z={-150} speed={-0.7} opacity={0.5} />
      </AbsoluteFill>

      {/* Phase A */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: pA }}>
        <div style={{ transform: `scale(${0.8 + 0.2 * qIn})`, opacity: qIn, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Emblem size={120} />
          <div
            style={{
              marginTop: 40,
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 96,
              color: "#fff",
              textAlign: "center",
              lineHeight: 1.1,
              textShadow: `0 0 40px ${BRAND.primary}88`,
            }}
          >
            Which tool impressed
            <br />
            you the <span style={{ color: BRAND.secondary }}>most?</span>
          </div>
        </div>
        <div
          style={{
            marginTop: 50,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "18px 34px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            border: `1px solid ${BRAND.secondary}88`,
            transform: `scale(${bubble})`,
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 34,
            color: "#fff",
          }}
        >
          <CommentIcon size={38} color={BRAND.secondary} />
          Tell us in the comments
        </div>
      </AbsoluteFill>

      {/* Phase B */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: pB, padding: 100 }}>
        <div style={{ fontFamily: displayFont, fontWeight: 700, fontSize: 72, color: "#fff", textAlign: "center", lineHeight: 1.15 }}>
          <div style={{ opacity: q1, transform: `translateY(${(1 - q1) * 40}px)` }}>Technology isn't just changing the future.</div>
          <div
            style={{
              marginTop: 20,
              opacity: q2,
              transform: `translateY(${(1 - q2) * 40}px)`,
              color: "transparent",
              backgroundImage: `linear-gradient(90deg, ${BRAND.secondary}, ${BRAND.primary}, ${BRAND.hot})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            It's giving us the tools to create it.
          </div>
        </div>
      </AbsoluteFill>

      {/* Phase C */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: pC }}>
        <Wordmark fontSize={90} delay={subscribeAt - 10} showTagline={false} />
        <div style={{ marginTop: 70, display: "flex", alignItems: "center", gap: 40, transform: `scale(${btnIn})` }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: like > 0.5 ? BRAND.secondary : "rgba(255,255,255,0.1)",
              transform: `scale(${0.6 + 0.4 * like}) rotate(${(1 - like) * -30}deg)`,
              boxShadow: like > 0.5 ? `0 0 50px ${BRAND.secondary}` : "none",
            }}
          >
            <ThumbIcon size={60} color="#fff" />
          </div>
          <div
            style={{
              padding: "30px 64px",
              borderRadius: 18,
              fontFamily: displayFont,
              fontWeight: 700,
              fontSize: 52,
              letterSpacing: "0.06em",
              color: subscribed ? "#c9c9d1" : "#fff",
              background: subscribed ? "#2a2a35" : "#ff0033",
              boxShadow: subscribed ? "none" : "0 0 60px #ff003399",
              transform: `scale(${press})`,
            }}
          >
            {subscribed ? "SUBSCRIBED" : "SUBSCRIBE"}
          </div>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.1)",
              border: `2px solid ${BRAND.primary}`,
              transform: `scale(${0.7 + 0.3 * bellIn}) rotate(${ring}deg)`,
            }}
          >
            <BellIcon size={60} color="#fff" />
          </div>
        </div>
      </AbsoluteFill>
      {pC > 0 && frame < clickAt + 20 ? (
        <div style={{ position: "absolute", left: cursorX, top: cursorY, opacity: pC, transform: `scale(${press})` }}>
          <CursorIcon size={64} />
        </div>
      ) : null}

      {/* Phase D: end screen */}
      {frame >= endAt ? (
        <AbsoluteFill style={{ opacity: pD * endFade }}>
          <RingTunnel colors={[BRAND.primary, BRAND.secondary]} travel={travel} rings={8} opacity={0.5} />
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 90 }}>
            <Wordmark fontSize={84} delay={endAt} />
          </AbsoluteFill>
          {/* Slots for YouTube end-screen elements */}
          {[
            { left: 150, label: "WATCH NEXT" },
            { left: 1040, label: "RECOMMENDED" },
          ].map((slot, i) => {
            const p = spring({ frame: frame - endAt - 10 - i * 6, fps, config: { damping: 16 } });
            return (
              <div
                key={slot.label}
                style={{
                  position: "absolute",
                  left: slot.left,
                  top: 400,
                  width: 730,
                  height: 410,
                  borderRadius: 20,
                  border: `3px solid ${i ? BRAND.primary : BRAND.secondary}`,
                  background: "rgba(8,10,24,0.55)",
                  boxShadow: `0 0 50px ${i ? BRAND.primary : BRAND.secondary}55`,
                  display: "flex",
                  alignItems: "flex-end",
                  padding: 24,
                  boxSizing: "border-box",
                  transform: `translateY(${(1 - p) * 80}px)`,
                  opacity: p,
                  fontFamily: displayFont,
                  fontWeight: 700,
                  fontSize: 28,
                  letterSpacing: "0.18em",
                  color: "#ffffffcc",
                }}
              >
                {slot.label}
              </div>
            );
          })}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 150,
              textAlign: "center",
              fontFamily: bodyFont,
              fontWeight: 600,
              fontSize: 40,
              color: "#dfe6ff",
              opacity: interpolate(frame, [lastLineEnd, lastLineEnd + 15], [0, 1], clamp),
            }}
          >
            See you in the next video
          </div>
        </AbsoluteFill>
      ) : null}

      <Subtitles cues={timing.cues} accent={BRAND.secondary} bottom={frame >= endAt ? 30 : 56} />
      <Voiceover timing={timing} />
    </AbsoluteFill>
  );
};
