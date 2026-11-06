import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";

export type Line = { key: string; who: string; text: string; sub: string; start: number; dur: number; radio: boolean; fiction: boolean; label: string };
export type Scene = { id: string; name: string; start: number; dur: number; lines: Line[]; caption: string[]; end: string[]; [k: string]: unknown };

const MONO = "'Liberation Mono', monospace";
const SANS = "Inter, sans-serif";

/** Dark blue-grey grade, vignette, grain, subtle exposure flicker. */
export const Grade: React.FC<{ strength?: number }> = ({ strength = 1 }) => {
  const frame = useCurrentFrame();
  const flick = 1 + (random(`f${frame}`) - 0.5) * 0.05;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#3d5672", mixBlendMode: "color", opacity: 0.3 * strength }} />
      <AbsoluteFill style={{ background: "#0b1420", mixBlendMode: "multiply", opacity: 0.06 * strength }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 38%, rgba(0,3,8,0.62) 100%)" }} />
      <AbsoluteFill style={{ background: `rgba(0,0,0,${(1 - flick) * 2 + 0.02})` }} />
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.11, mixBlendMode: "overlay" }}>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(random(frame) * 999)} /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Radio-static glitch used on every cut: noise, tearing lines, a dip to black. */
export const Glitch: React.FC<{ at: number; len?: number; strength?: number }> = ({ at, len = 0.45, strength = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps - at;
  if (t < -len / 2 || t > len) return null;
  const k = 1 - Math.abs(t) / len;
  const bars = Array.from({ length: 9 }, (_, i) => ({ y: random(`y${frame}-${i}`) * height, h: 4 + random(`h${frame}-${i}`) * 40, o: random(`o${frame}-${i}`) }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#000", opacity: Math.max(0, k * 0.85 * strength) }} />
      <svg width={width} height={height} style={{ position: "absolute", opacity: k * 0.55 * strength, mixBlendMode: "screen" }}>
        <filter id={`gn${frame}`}><feTurbulence type="fractalNoise" baseFrequency="0.9 0.02" numOctaves={1} seed={frame} /></filter>
        <rect width="100%" height="100%" filter={`url(#gn${frame})`} />
      </svg>
      {bars.map((b, i) => (
        <div key={i} style={{ position: "absolute", left: 0, right: 0, top: b.y, height: b.h, background: `rgba(${180 + b.o * 60},${200 + b.o * 40},255,${0.12 * k * strength})`, transform: `translateX(${(b.o - 0.5) * 120 * k}px)` }} />
      ))}
    </AbsoluteFill>
  );
};

/** Typewriter caption (date / place / disclaimers), top-left. */
export const Caption: React.FC<{ lines: string[]; from: number; to: number; fiction?: boolean }> = ({ lines, from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (t < from || t > to) return null;
  const out = interpolate(t, [to - 0.5, to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let budget = Math.floor((t - from) * 34);
  return (
    <div style={{ position: "absolute", left: 70, top: 190, right: 70, opacity: out }}>
      {lines.map((l, i) => {
        const shown = l.slice(0, Math.max(0, budget));
        budget -= l.length + 6;
        const warn = /FICTION|DRAMATI|RECREATED|APPROX/.test(l);
        return (
          <div key={i} style={{ fontFamily: MONO, fontWeight: 700, fontSize: i === 0 ? 34 : 27, letterSpacing: 2.5, color: warn ? "#e8b04a" : "#e6e9ee", textShadow: "0 2px 10px rgba(0,0,0,0.9)", marginTop: i ? 10 : 0, lineHeight: 1.35 }}>
            {shown}
            {shown.length < l.length && shown.length > 0 ? <span style={{ opacity: frame % 16 < 8 ? 1 : 0 }}>▌</span> : null}
          </div>
        );
      })}
    </div>
  );
};

/** Subtitles with speaker tag; radio lines get a "transmitting" indicator. */
export const Subtitles: React.FC<{ lines: Line[] }> = ({ lines }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const l = lines.find((x) => t >= x.start - 0.05 && t < x.start + x.dur + 0.35);
  if (!l) return null;
  // split long lines into two timed halves at a sentence/comma boundary
  const parts = splitText(l.sub || l.text);
  const each = l.dur / parts.reduce((a, p) => a + p.length, 0);
  let acc = 0, part = parts[0];
  for (const p of parts) { if (t - l.start >= acc * each - 0.05) part = p; acc += p.length; }
  const a = interpolate(t, [l.start - 0.05, l.start + 0.15, l.start + l.dur + 0.15, l.start + l.dur + 0.35], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ghost = l.who === "GHOST";
  const tag = l.who === "NARRATOR" ? "" : l.label;
  const jitter = ghost ? (random(`gx${frame}`) - 0.5) * 6 : 0;
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: 1240, display: "flex", flexDirection: "column", alignItems: "center", opacity: a }}>
      {l.radio ? (
        <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: 2, color: "#ff5a48", marginBottom: 10, opacity: frame % 20 < 13 ? 1 : 0.35 }}>● RADIO</div>
      ) : null}
      {tag ? <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 25, letterSpacing: 2.2, color: /DRAMATI|FICTION/.test(tag) ? "#e8b04a" : "#9fb6d2", marginBottom: 12, textAlign: "center" }}>{tag}</div> : null}
      <div
        style={{
          fontFamily: ghost ? MONO : SANS, fontWeight: ghost ? 700 : 600, fontSize: ghost ? 54 : 50, lineHeight: 1.3, textAlign: "center",
          color: ghost ? "#d9e6f2" : "#f4f5f7", textShadow: "0 3px 14px rgba(0,0,0,0.95), 0 0 2px #000", transform: `translateX(${jitter}px)`,
          letterSpacing: ghost ? 3 : 0.2,
        }}
      >
        {l.radio && !ghost ? "“" : ""}{part}{l.radio && !ghost ? "”" : ""}
      </div>
    </div>
  );
};

function splitText(s: string): string[] {
  if (s.length <= 56) return [s];
  const mid = s.length / 2;
  let best = -1;
  for (let i = 0; i < s.length; i++) if (/[.,?]/.test(s[i]) && s[i + 1] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  if (best < 0) return [s];
  return [s.slice(0, best + 1), ...splitText(s.slice(best + 2))];
}

/** Final title card + truth disclaimer. */
export const TitleCard: React.FC<{ from: number; title: string; notes: string[] }> = ({ from, title, notes }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - from;
  if (t < 0) return null;
  const a = interpolate(t, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
  const [main, sub] = title.split(":");
  const shake = t < 0.4 ? (random(`ts${frame}`) - 0.5) * 14 * (1 - t / 0.4) : 0;
  return (
    <AbsoluteFill style={{ background: `rgba(2,4,8,${0.78 * a})`, justifyContent: "center", alignItems: "center", flexDirection: "column", opacity: a }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 96, letterSpacing: 10, color: "#e9edf2", transform: `translateX(${shake}px)`, textShadow: "0 0 30px rgba(120,160,220,0.35)" }}>{main.trim()}</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 46, letterSpacing: 8, color: "#c43a2f", marginTop: 18 }}>{(sub ?? "").trim()}</div>
      <div style={{ marginTop: 120, padding: "0 90px", textAlign: "center", opacity: interpolate(t, [1.0, 1.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        {notes.map((n, i) => (
          <div key={i} style={{ fontFamily: SANS, fontSize: 27, lineHeight: 1.45, color: "#9aa8b8", marginTop: 12 }}>{n}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Rain streaks for storm / night scenes. */
export const Rain: React.FC<{ amount?: number }> = ({ amount = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drops = Array.from({ length: Math.round(110 * amount) }, (_, i) => {
    const x = random(`rx${i}`) * width, sp = 1400 + random(`rs${i}`) * 900, len = 40 + random(`rl${i}`) * 70;
    const y = ((random(`ry${i}`) * height + (frame / 30) * sp) % (height + 200)) - 100;
    return { x, y, len, o: 0.08 + random(`ro${i}`) * 0.14 };
  });
  return (
    <svg width={width} height={height} style={{ position: "absolute", pointerEvents: "none" }}>
      {drops.map((d, i) => <line key={i} x1={d.x} y1={d.y} x2={d.x - d.len * 0.18} y2={d.y + d.len} stroke={`rgba(200,215,235,${d.o})`} strokeWidth={1.6} />)}
    </svg>
  );
};
