import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { Canvas3D, Search } from "./Scenes3D";
import { Den, MapleHouse, OtherPool, Pool, WillJoyce } from "./Scenes2";
import { Glitch, Grade } from "./Overlays";

type Sc = (typeof timeline.scenes)[number] & Record<string, unknown>;
export const SCENES = timeline.scenes as unknown as Sc[];
const SANS = "Inter, sans-serif";
const MONO = "'Liberation Mono', monospace";
const fade = (t: number, a: number, b: number, c: number, d: number) => interpolate(t, [a, b, c, d], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Plain-text series title (deliberately not the show's logo). */
const OpenTitle: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const t = useCurrentFrame() / 30;
  const a = fade(t, from, from + 0.8, to - 0.5, to);
  if (a <= 0) return null;
  const spread = interpolate(t, [from, to], [14, 22]);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", opacity: a, background: `rgba(0,0,0,${0.35 * a})` }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 76, letterSpacing: spread, color: "#e8e2da", textShadow: "0 0 24px rgba(220,40,30,0.55), 0 4px 18px #000", paddingLeft: spread }}>{timeline.series}</div>
      <div style={{ width: 640, height: 2, background: "rgba(220,50,40,0.8)", margin: "26px 0", boxShadow: "0 0 14px rgba(255,40,30,0.8)" }} />
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, letterSpacing: 4, color: "#d9473b", textShadow: "0 3px 14px #000" }}>{timeline.title}</div>
    </AbsoluteFill>
  );
};

const Place: React.FC<{ text: string; from: number; to: number }> = ({ text, from, to }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  if (t < from || t > to) return null;
  const n = Math.floor((t - from) * 28);
  return (
    <div style={{ position: "absolute", left: 70, top: 200, fontFamily: MONO, fontWeight: 700, fontSize: 32, letterSpacing: 3, color: "#e6e2d8", opacity: fade(t, from, from + 0.1, to - 0.4, to), textShadow: "0 2px 10px #000" }}>
      {text.slice(0, n)}{n < text.length ? <span style={{ opacity: frame % 16 < 8 ? 1 : 0 }}>▌</span> : null}
    </div>
  );
};

/** Eyelids: black curtains that blink open. */
const Eyelids: React.FC<{ from: number }> = ({ from }) => {
  const t = useCurrentFrame() / 30 - from;
  const o = t < 0 ? 0 : t < 0.5 ? 0.25 * (t / 0.5) : t < 0.8 ? 0.25 - 0.2 * ((t - 0.5) / 0.3) : t < 1.1 ? 0.05 + 0.25 * ((t - 0.8) / 0.3) : t < 1.4 ? 0.3 - 0.1 * ((t - 1.1) / 0.3) : Math.min(1, 0.2 + (t - 1.4) * 0.8);
  if (o >= 1) return null;
  const h = 50 * (1 - o);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: "-20%", right: "-20%", top: 0, height: `${h}%`, background: "#000", borderBottomLeftRadius: "50% 30%", borderBottomRightRadius: "50% 30%", filter: "blur(18px)" }} />
      <div style={{ position: "absolute", left: "-20%", right: "-20%", bottom: 0, height: `${h}%`, background: "#000", borderTopLeftRadius: "50% 30%", borderTopRightRadius: "50% 30%", filter: "blur(18px)" }} />
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ d: number }> = ({ d }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const q = t > 0.15 ? 1 : 0;
  const p = t > 1.5 ? 1 : 0;
  const c = t > 2.3 ? 1 : 0;
  const jit = t > 0.15 && t < 0.5 ? (random(`e${frame}`) - 0.5) * 18 : 0;
  const blink = Math.floor(t * 2.4) % 2 ? 1 : 0.5;
  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 84, letterSpacing: 5, color: "#ece6dc", opacity: q, transform: `translateX(${jit}px)`, textShadow: "0 0 30px rgba(230,40,30,0.7)" }}>THE MONSTER IS REAL.</div>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 46, letterSpacing: 10, color: "#d9473b", marginTop: 60, opacity: p }}>PART 3 COMING...</div>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: 2, color: "#e8e2da", marginTop: 90, opacity: c * blink, border: "2px solid rgba(217,71,59,0.8)", borderRadius: 14, padding: "14px 30px" }}>Comment “PART 3” now 👇</div>
      <div style={{ position: "absolute", bottom: 150, fontFamily: SANS, fontSize: 24, color: "#6f6a64", opacity: p, letterSpacing: 1 }}>Fan-made recap · not affiliated with Netflix</div>
    </AbsoluteFill>
  );
};

export const SceneShot: React.FC<{ id: string }> = ({ id }) => {
  const sc = SCENES.find((s) => s.id === id)!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const d = sc.dur as number;
  const n = (k: string) => sc[k] as number;
  const L0 = (sc.lines as unknown as { start: number; dur: number }[])[0];
  let shot: React.ReactNode = null;
  const inner: number[] = [];
  const over: React.ReactNode[] = [];
  let exposure = 1.2, hardOut = false, black = 0;
  if (id === "s1") {
    shot = <MapleHouse t={t} d={d} cutA={n("cutA")} cutB={n("cutB")} />;
    inner.push(n("cutA"), n("cutB"));
    over.push(<OpenTitle key="ot" from={0} to={n("cutA") - 0.2} />);
    exposure = 1.3;
  } else if (id === "s2") {
    shot = <Den t={t} d={d} mode="powers" liftAt={n("liftAt")} />;
    over.push(<Place key="p" text="THE BASEMENT" from={0.3} to={2.6} />);
    exposure = 1.3;
  } else if (id === "s3") {
    shot = <WillJoyce t={t} d={d} cut={n("cut")} />;
    inner.push(n("cut"));
    over.push(<Place key="p" text="THE OTHER SIDE" from={0.3} to={2.6} />);
    exposure = 1.2;
  } else if (id === "s4") {
    shot = <Search t={t + 2} d={d + 2} />;
    exposure = 1.0;
  } else if (id === "s5") {
    shot = <Pool t={t} d={d} mode="party" />;
    over.push(<Place key="p" text="THAT NIGHT · A PARTY" from={0.3} to={2.8} />);
    exposure = 1.3;
  } else if (id === "s6") {
    shot = <Pool t={t} d={d} mode="attack" dropAt={n("dropAt")} grabAt={n("grabAt")} />;
    inner.push(n("grabAt") - 0.6);
    exposure = 1.3;
  } else if (id === "s7") {
    shot = <OtherPool t={t} d={d} />;
    over.push(<Eyelids key="e" from={0} />);
    exposure = 1.25;
  } else if (id === "s8") {
    shot = <Den t={t} d={d} mode="freeze" whisperAt={n("whisperAt")} blastAt={n("blastAt")} />;
    inner.push(n("whisperAt") - 1.2);
    hardOut = true;
    black = n("blastAt");
    exposure = 1.3;
  } else {
    return <AbsoluteFill style={{ background: "#000" }}><EndCard d={d} /></AbsoluteFill>;
  }
  const fadeIn = interpolate(t, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = hardOut ? 1 : interpolate(t, [d - 0.25, d], [1, 0], { extrapolateLeft: "clamp" });
  const flash = black ? interpolate(t, [black, black + 0.06, black + 0.3], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {black && t >= black + 0.3 ? null : (
        <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
          <Canvas3D exposure={exposure}>{shot}</Canvas3D>
          <Grade />
        </AbsoluteFill>
      )}
      {over}
      {flash > 0 ? <AbsoluteFill style={{ background: "#fff6e8", opacity: flash }} /> : null}
      {id !== "s1" ? <Glitch at={0} len={0.3} strength={0.6} /> : null}
      {inner.map((c) => <Glitch key={c} at={c} len={0.3} strength={0.9} />)}
      {L0 ? null : null}
    </AbsoluteFill>
  );
};
