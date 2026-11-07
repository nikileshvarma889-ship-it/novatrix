import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { drawOcean, OceanState } from "./oceanDisplay";

const MONO = "'Liberation Mono', monospace";
const SANS = "Inter, sans-serif";

/** Full-screen ATC radar display (canvas), with a slow push-in and CRT feel. */
export const RadarShot: React.FC<{ state: OceanState; zoom: number; focus: [number, number]; shake?: number }> = ({ state, zoom, focus, shake = 0 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  useLayoutEffect(() => {
    const c = ref.current!;
    drawOcean(c.getContext("2d")!, c.width, c.height, state);
  });
  const jx = shake ? (random(`rx${frame}`) - 0.5) * shake * 10 : 0;
  const size = width * 1.25;
  return (
    <AbsoluteFill style={{ background: "#010304", overflow: "hidden" }}>
      <canvas
        ref={ref}
        width={1400}
        height={1400}
        style={{
          position: "absolute", width: size, height: size, left: (width - size) / 2 + jx, top: (height - size) / 2 + 50,
          transform: `scale(${zoom})`, transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`,
          filter: "contrast(1.08) saturate(1.1)",
        }}
      />
      {/* monitor glass reflection + bezel falloff */}
      <AbsoluteFill style={{ background: "linear-gradient(160deg, rgba(120,170,220,0.05) 0%, rgba(0,0,0,0) 35%)" }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)`, height }} />
    </AbsoluteFill>
  );
};

/** Opening title (over the takeoff). */
export const OpenTitle: React.FC<{ from: number; to: number; title: string; part: string }> = ({ from, to, title, part }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (t < from || t > to) return null;
  const a = interpolate(t, [from, from + 0.8, to - 0.7, to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const [main, sub] = title.split(":");
  const jit = (random(`ot${frame}`) - 0.5) * 3 * (random(`og${Math.floor(frame / 3)}`) > 0.85 ? 4 : 0.4);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", opacity: a }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, letterSpacing: 14, color: "#c43a2f" }}>{part}</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 150, letterSpacing: 14, color: "#eef2f6", marginTop: 14, transform: `translateX(${jit}px)`, textShadow: "0 0 40px rgba(130,170,230,0.35), 0 4px 18px rgba(0,0,0,0.9)" }}>{main.trim()}</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 44, letterSpacing: 8, color: "#d9dee5", marginTop: 6, textShadow: "0 4px 18px rgba(0,0,0,0.9)" }}>{(sub ?? "").trim()}</div>
    </div>
  );
};

/** End card: facts, then the Part 2 tease. */
export const EndCard: React.FC<{ notes: string[]; next: string; cta: string }> = ({ notes, next, cta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const f = (a: number, b: number) => interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flick = random(`ec${Math.floor(frame / 2)}`) > 0.92 ? 0.55 : 1;
  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center", flexDirection: "column", padding: "0 80px" }}>
      {notes.map((n, i) => (
        <div key={i} style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, color: "#b8c2ce", opacity: f(0.3 + i * 0.6, 0.9 + i * 0.6), marginTop: i ? 14 : 0, textAlign: "center" }}>{n}</div>
      ))}
      <div style={{ height: 150 }} />
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 36, letterSpacing: 10, color: "#c43a2f", opacity: f(1.7, 2.1) * flick }}>{next.split("—")[0].trim()}</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 68, letterSpacing: 6, color: "#eef2f6", marginTop: 16, textAlign: "center", opacity: f(1.9, 2.4) * flick, textShadow: "0 0 30px rgba(196,58,47,0.45)" }}>{(next.split("—")[1] ?? "").trim()}</div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: "#e8b04a", marginTop: 90, opacity: f(2.8, 3.2) * (0.75 + 0.25 * Math.sin(t * 5)) }}>{cta}</div>
    </AbsoluteFill>
  );
};

/** Final screen: title, "THE END?", then the facts and the fiction note. */
export const FinalCard: React.FC<{ notes: string[] }> = ({ notes }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const f = (a: number, b: number) => interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flick = random(`fc${Math.floor(frame / 2)}`) > 0.9 ? 0.5 : 1;
  const shake = t < 0.5 ? (random(`fs${frame}`) - 0.5) * 16 * (1 - t / 0.5) : 0;
  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center", flexDirection: "column", padding: "0 70px" }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 170, letterSpacing: 16, color: "#eef2f6", opacity: f(0.05, 0.6), transform: `translateX(${shake}px)`, textShadow: "0 0 50px rgba(130,170,230,0.3)" }}>MH370</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 40, letterSpacing: 6, color: "#c9d1da", marginTop: 18, textAlign: "center", opacity: f(0.7, 1.3) }}>THE FLIGHT THAT NEVER CAME HOME</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 64, letterSpacing: 12, color: "#c43a2f", marginTop: 90, opacity: f(1.8, 2.3) * flick, textShadow: "0 0 30px rgba(196,58,47,0.5)" }}>THE END?</div>
      <div style={{ marginTop: 110, opacity: f(2.8, 3.4) }}>
        {notes.map((n, i) => <div key={i} style={{ fontFamily: SANS, fontWeight: 600, fontSize: 27, color: "#8e9aa8", textAlign: "center", marginTop: 8 }}>{n}</div>)}
      </div>
    </AbsoluteFill>
  );
};
