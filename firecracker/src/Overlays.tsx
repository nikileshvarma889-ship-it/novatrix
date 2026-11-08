import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { CamSpec, V3, project, clamp01 } from "./sim";

export type Line = { key: string; who: string; text: string; sub: string; start: number; dur: number };
export type Scene = { id: string; name: string; start: number; dur: number; lines: Line[]; ev: Record<string, any> };

export const SANS = "Inter, sans-serif";
export const MONO = "'Liberation Mono', monospace";
const fadeIO = (t: number, a: number, b: number, f = 0.35) => interpolate(t, [a, a + f, b - f, b], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Light cinematic finish: gentle vignette, fine grain. */
export const Grade: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.06, mixBlendMode: "overlay" }}>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(random(frame) * 999)} /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Dip from / to black at the scene edges. */
export const Dip: React.FC<{ t: number; d: number; inLen?: number; outLen?: number }> = ({ t, d, inLen = 0.25, outLen = 0.2 }) => {
  const a = Math.max(inLen > 0 ? 1 - t / inLen : 0, outLen > 0 ? 1 - (d - t) / outLen : 0);
  return a > 0 ? <AbsoluteFill style={{ background: "#000", opacity: clamp01(a) }} /> : null;
};

/** Chapter tag, top-left. */
export const Tag: React.FC<{ t: number; n: string; title: string; to: number; note?: string }> = ({ t, n, title, to, note }) => {
  const a = fadeIO(t, 0.2, to, 0.4);
  if (a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 64, top: 230, opacity: a }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, color: "#ffb04a", border: "2px solid #ffb04a", borderRadius: 8, padding: "2px 10px" }}>{n}</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 36, letterSpacing: 3, color: "#f3f4f6", textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}>{title}</div>
      </div>
      {note ? <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 23, letterSpacing: 2, color: "#9fb2c8", marginTop: 12 }}>{note}</div> : null}
    </div>
  );
};

/** Callout pinned to a 3D point: dot on the object, leader line, text box on the left or right edge. */
export const Label: React.FC<{ t: number; cam: CamSpec; at: V3; text: string; sub?: string; side: "left" | "right"; y?: number; from: number; to: number; color?: string }> = ({ t, cam, at, text, sub, side, y, from, to, color = "#ffb04a" }) => {
  const a = fadeIO(t, from, to);
  if (a <= 0) return null;
  const p = project(cam, at);
  if (!p.visible) return null;
  const by = y ?? p.y;
  const grow = clamp01((t - from) / 0.35);
  const bx = side === "left" ? 60 : 1080 - 60;
  const lx = side === "left" ? 60 + 330 : 1080 - 60 - 330;
  const ex = lx + (p.x - lx) * grow, ey = by + (p.y - by) * grow;
  return (
    <AbsoluteFill style={{ opacity: a, pointerEvents: "none" }}>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <line x1={lx} y1={by} x2={ex} y2={ey} stroke={color} strokeWidth={3} />
        <circle cx={p.x} cy={p.y} r={9 * grow} fill="none" stroke={color} strokeWidth={3} />
        <circle cx={p.x} cy={p.y} r={4 * grow} fill={color} />
      </svg>
      <div style={{ position: "absolute", top: by - 30, [side]: 60, width: 330, textAlign: side, borderBottom: `3px solid ${color}`, paddingBottom: 8 } as React.CSSProperties}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 33, lineHeight: 1.1, color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,0.95)" }}>{text}</div>
        {sub ? <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 24, color: "#c8d2de", marginTop: 6, textShadow: "0 2px 8px #000" }}>{sub}</div> : null}
      </div>
      <div style={{ position: "absolute", left: bx, top: 0 }} />
    </AbsoluteFill>
  );
};

/** Pressure meter on the right edge. */
export const Gauge: React.FC<{ t: number; value: number; from: number; to: number; burst?: boolean }> = ({ t, value, from, to, burst }) => {
  const a = fadeIO(t, from, to, 0.3);
  if (a <= 0) return null;
  const v = clamp01(value);
  const col = v < 0.5 ? "#ffd04a" : v < 0.85 ? "#ff8a2a" : "#ff3b2a";
  const frame = useCurrentFrame();
  const H = 520;
  return (
    <div style={{ position: "absolute", right: 64, top: 470, width: 70, opacity: a, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: 2, color: "#e8ecf2", marginBottom: 14, textShadow: "0 2px 8px #000" }}>PRESSURE</div>
      <div style={{ position: "relative", width: 34, height: H, borderRadius: 17, border: "3px solid rgba(255,255,255,0.75)", background: "rgba(0,0,0,0.45)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${v * 100}%`, background: `linear-gradient(0deg, #ffd04a, ${col})`, boxShadow: `0 0 20px ${col}` }} />
      </div>
      {burst ? <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: "#ff3b2a", marginTop: 14, opacity: frame % 10 < 6 ? 1 : 0.4 }}>MAX</div> : null}
    </div>
  );
};

export const Badge: React.FC<{ t: number; from: number; to: number; text: string; color?: string; top?: number }> = ({ t, from, to, text, color = "#ffffff", top = 330 }) => {
  const a = fadeIO(t, from, to, 0.3);
  if (a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 64, top, opacity: a, fontFamily: MONO, fontWeight: 700, fontSize: 24, letterSpacing: 3, color, background: "rgba(0,0,0,0.45)", border: `2px solid ${color}55`, borderRadius: 8, padding: "6px 14px" }}>{text}</div>
  );
};

const KEY = /^(firecracker|heat|gases|pressure|casing|ruptures|bang|wave|burst|fly|thrust|rotate|turning|force|explosion|rotation|safely|explodes|downward|upward)$/i;
/** Subtitles in the lower third, timed in halves for long lines, key words highlighted. */
export const Subtitles: React.FC<{ lines: Line[] }> = ({ lines }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const l = lines.find((x) => t >= x.start - 0.05 && t < x.start + x.dur + 0.3);
  if (!l) return null;
  const parts = splitText(l.sub);
  const each = l.dur / parts.reduce((a, p) => a + p.length, 0);
  let acc = 0, part = parts[0];
  for (const p of parts) { if (t - l.start >= acc * each - 0.05) part = p; acc += p.length; }
  const a = interpolate(t, [l.start - 0.05, l.start + 0.12, l.start + l.dur + 0.12, l.start + l.dur + 0.3], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 1270, display: "flex", justifyContent: "center", opacity: a }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, lineHeight: 1.28, textAlign: "center", color: "#fff", textShadow: "0 3px 14px rgba(0,0,0,0.95), 0 0 3px #000" }}>
        {part.split(" ").map((w, i) => (
          <span key={i} style={{ color: KEY.test(w.replace(/[^a-z]/gi, "")) ? "#ffc14a" : "#fff" }}>{w}{" "}</span>
        ))}
      </div>
    </div>
  );
};
function splitText(s: string): string[] {
  if (s.length <= 52) return [s];
  const mid = s.length / 2;
  let best = -1;
  for (let i = 0; i < s.length; i++) if (/[.,?…]/.test(s[i]) && s[i + 1] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  if (best < 0 || Math.abs(best - mid) > s.length * 0.3) {
    best = -1;
    for (let i = 0; i < s.length; i++) if (s[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    return [s.slice(0, best), ...splitText(s.slice(best + 1))];
  }
  return [s.slice(0, best + 1), ...splitText(s.slice(best + 2))];
}

/** Opening title. */
export const Title: React.FC<{ t: number; from: number; to: number }> = ({ t, from, to }) => {
  const a = fadeIO(t, from, to, 0.6);
  if (a <= 0) return null;
  const k = clamp01((t - from) / 1.2);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", opacity: a }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, letterSpacing: 14 * (0.7 + 0.3 * k), color: "#ffb04a" }}>INSIDE A</div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 112, letterSpacing: 6, color: "#fff", lineHeight: 1.05, textShadow: "0 0 40px rgba(255,140,40,0.45), 0 4px 18px #000" }}>FIRECRACKER</div>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, letterSpacing: 3, color: "#9fb2c8", marginTop: 22 }}>THE SCIENCE OF A BANG · SIMPLIFIED</div>
    </div>
  );
};

/** Three effect chips (explosion / thrust / rotation) with tiny icons. */
export const Effects: React.FC<{ t: number; at: number[]; to: number; top?: number }> = ({ t, at, to, top = 330 }) => {
  const items = [
    { name: "EXPLOSION", sub: "sealed casing bursts", c: "#ff6a2c", icon: (c: string) => <g stroke={c} strokeWidth={5} strokeLinecap="round">{Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={30 + Math.cos(a) * 9} y1={30 + Math.sin(a) * 9} x2={30 + Math.cos(a) * 24} y2={30 + Math.sin(a) * 24} />; })}</g> },
    { name: "THRUST", sub: "gas escapes one way", c: "#38e07a", icon: (c: string) => <g fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"><line x1={30} y1={52} x2={30} y2={10} /><polyline points="14,26 30,10 46,26" /></g> },
    { name: "ROTATION", sub: "exhaust pushes sideways", c: "#4ab4ff", icon: (c: string) => <g fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"><path d="M 50 30 A 20 20 0 1 1 38 12" /><polyline points="30,6 40,12 34,22" /></g> },
  ];
  const out = fadeIO(t, at[0], to, 0.3);
  if (out <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top, display: "flex", flexDirection: "column", gap: 20, opacity: out }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, letterSpacing: 4, color: "#fff", textShadow: "0 3px 14px #000", marginBottom: 6 }}>ONE REACTION</div>
      {items.map((it, i) => {
        const k = clamp01((t - at[i]) / 0.35);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 22, opacity: k, transform: `translateX(${(1 - k) * -40}px)`, background: "rgba(5,8,16,0.55)", border: `2px solid ${it.c}88`, borderRadius: 16, padding: "12px 20px", width: 600 }}>
            <svg width={60} height={60}>{it.icon(it.c)}</svg>
            <div>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: it.c, letterSpacing: 2 }}>{it.name}</div>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26, color: "#d5dce6" }}>{it.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Clean ending: safety message + title. */
export const EndCard: React.FC<{ t: number; from: number }> = ({ t, from }) => {
  const a = clamp01((t - from) / 0.7);
  if (a <= 0) return null;
  const b = clamp01((t - from - 0.5) / 0.6);
  return (
    <AbsoluteFill style={{ background: `rgba(3,5,10,${0.72 * a})`, alignItems: "center", opacity: a }}>
      <div style={{ position: "absolute", top: 420, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 36, letterSpacing: 12, color: "#ffb04a" }}>INSIDE A</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 92, letterSpacing: 5, color: "#fff" }}>FIRECRACKER</div>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: 3, color: "#c6d0dc", marginTop: 18 }}>EXPLOSION · THRUST · ROTATION</div>
      </div>
      <div style={{ position: "absolute", top: 820, left: 90, right: 90, opacity: b, transform: `scale(${0.95 + 0.05 * b})`, border: "3px solid #ffc14a", borderRadius: 22, background: "rgba(40,28,6,0.55)", padding: "30px 34px", display: "flex", alignItems: "center", gap: 26 }}>
        <svg width={86} height={78} style={{ flex: "none" }}><path d="M43 4 L83 74 L3 74 Z" fill="none" stroke="#ffc14a" strokeWidth={6} strokeLinejoin="round" /><line x1={43} y1={28} x2={43} y2={52} stroke="#ffc14a" strokeWidth={7} strokeLinecap="round" /><circle cx={43} cy={63} r={4.5} fill="#ffc14a" /></svg>
        <div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 38, lineHeight: 1.2, color: "#fff" }}>Never experiment with firecrackers yourself.</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: "#ffc14a", marginTop: 10 }}>Enjoy fireworks safely!</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1130, left: 90, right: 90, textAlign: "center", opacity: b, fontFamily: SANS, fontWeight: 600, fontSize: 24, lineHeight: 1.45, color: "#8e9bab" }}>
        Simplified educational animation. Not a demonstration — no real explosives were used.
      </div>
    </AbsoluteFill>
  );
};
