import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { Basement, Canvas3D, House, Lab, RainWoods, Road, Search } from "./Scenes3D";
import { Glitch, Grade, Rain } from "./Overlays";

type Sc = (typeof timeline.scenes)[number] & Record<string, unknown>;
export const SCENES = timeline.scenes as unknown as Sc[];
const SANS = "Inter, sans-serif";
const MONO = "'Liberation Mono', monospace";
const fade = (t: number, a: number, b: number, c: number, d: number) => interpolate(t, [a, b, c, d], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Plain-text series title (deliberately not the show's logo). */
const OpenTitle: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const a = fade(t, from, from + 0.8, to - 0.5, to);
  if (a <= 0) return null;
  const spread = interpolate(t, [from, to], [14, 22]);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", opacity: a }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 76, letterSpacing: spread, color: "#e8e2da", textShadow: "0 0 24px rgba(220,40,30,0.55), 0 4px 18px #000", paddingLeft: spread }}>{timeline.series}</div>
      <div style={{ width: 640, height: 2, background: "rgba(220,50,40,0.8)", margin: "26px 0", boxShadow: "0 0 14px rgba(255,40,30,0.8)" }} />
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 40, letterSpacing: 5, color: "#d9473b", textShadow: "0 3px 14px #000" }}>{timeline.title}</div>
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

const EndCard: React.FC<{ d: number }> = ({ d }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const q = fade(t, 0.3, 0.9, d, d + 1);
  const p = fade(t, 1.7, 2.2, d, d + 1);
  const jit = t > 0.3 && t < 0.7 ? (random(`e${frame}`) - 0.5) * 16 : 0;
  const blink = t > 2.2 ? (Math.floor(t * 2.2) % 2 ? 1 : 0.55) : 1;
  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 92, letterSpacing: 6, color: "#ece6dc", opacity: q, transform: `translateX(${jit}px)`, textShadow: "0 0 30px rgba(230,40,30,0.6)" }}>WHO IS ELEVEN?</div>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 48, letterSpacing: 10, color: "#d9473b", marginTop: 60, opacity: p * blink }}>PART 2 COMING...</div>
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
  let shot: React.ReactNode = null;
  const inner: number[] = [];
  const over: React.ReactNode[] = [];
  let exposure = 1.1, grade = 1, end = false;
  if (id === "s1") {
    shot = <Lab t={t} d={d} doorsAt={n("doorsAt")} />;
    inner.push(n("doorsAt") - 1.6);
    over.push(<OpenTitle key="ot" from={0} to={1.2 + 3.1 + 0.2} />);
    exposure = 1.3;
  } else if (id === "s2") {
    shot = <Basement t={t} d={d} rollAt={n("rollAt")} />;
    over.push(<Place key="p" text="THAT EVENING · A BASEMENT" from={0.3} to={3} />);
    exposure = 1.25;
  } else if (id === "s3") {
    shot = <Road t={t} d={d} seeAt={n("seeAt")} crashAt={n("crashAt")} shedAt={n("shedAt")} />;
    inner.push(n("crashAt"), n("shedAt"));
    exposure = 1.45;
  } else if (id === "s4") {
    shot = <House t={t} d={d} />;
    over.push(<Place key="p" text="NEXT MORNING" from={0.3} to={2.8} />);
  } else if (id === "s5") {
    shot = <Search t={t} d={d} />;
    over.push(<Place key="p" text="POLICE SEARCH · THE WOODS" from={0.2} to={3} />);
    exposure = 1.0; grade = 0.8;
  } else if (id === "s6") {
    shot = <RainWoods t={t} d={d} girlAt={n("girlAt")} />;
    over.push(<Rain key="r" amount={1.2} />);
    exposure = 1.5;
  } else {
    end = true;
  }
  if (end) return <AbsoluteFill style={{ background: "#000" }}><EndCard d={d} /><Glitch at={0.3} len={0.4} /></AbsoluteFill>;
  const fadeIn = interpolate(t, [0, 0.3], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = id === "s6" ? interpolate(t, [d - 1.6, d - 0.1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : interpolate(t, [d - 0.25, d], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
        <Canvas3D exposure={exposure}>{shot}</Canvas3D>
        {over.filter((o) => (o as React.ReactElement).key === "r")}
        <Grade strength={grade} />
      </AbsoluteFill>
      {over.filter((o) => (o as React.ReactElement).key !== "r")}
      <Glitch at={0} len={0.3} strength={0.6} />
      {inner.map((c) => <Glitch key={c} at={c} len={0.3} strength={0.9} />)}
    </AbsoluteFill>
  );
};
