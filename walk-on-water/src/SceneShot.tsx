import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { Canvas3D } from "./Scenes3D";
import { Boat, Cam, clamp01, ease, flashAt, lerp3, Robed, sm, waveH, World } from "./Sea";
import { Grade } from "./Overlays";
import type { V3 } from "./Scenes3D";

type Sc = (typeof timeline.scenes)[number] & Record<string, unknown>;
export const SCENES = timeline.scenes as unknown as Sc[];
const SERIF = "'Liberation Serif', serif";

const Title: React.FC<{ text: string; from: number; to: number; top?: number; size?: number }> = ({ text, from, to, top = 820, size = 70 }) => {
  const t = useCurrentFrame() / 30;
  const a = interpolate(t, [from, from + 0.9, to - 0.6, to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (a <= 0) return null;
  const spread = interpolate(t, [from, to], [6, 11]);
  return (
    <div style={{ position: "absolute", left: 50, right: 50, top, textAlign: "center", opacity: a, fontFamily: SERIF, fontWeight: 700, fontSize: size, letterSpacing: spread, lineHeight: 1.3, color: "#f2e8d2", textShadow: "0 0 30px rgba(255,220,160,0.35), 0 4px 18px rgba(0,0,0,0.9)" }}>
      {text}
    </div>
  );
};

const JESUS = { robe: "#e9e4d8", mantle: "#d8cdb5", skin: "#a87b5c", hair: "#3a2618" };
const PETER = { robe: "#5a4632", mantle: "#7a5a3a", skin: "#9a6c4e", hair: "#241812" };
const CREW = [{ robe: "#4a3c2e" }, { robe: "#3c4048" }, { robe: "#5b4a38" }, { robe: "#463a30" }];
const on = (p: V3, t: number, storm: number, dy = 0): V3 => [p[0], waveH(p[0], p[2], t, storm) * 0.95 + dy, p[2]];

export const SceneShot: React.FC<{ id: string }> = ({ id }) => {
  const sc = SCENES.find((s) => s.id === id)!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps, d = sc.dur as number;
  const T = (sc.start as number) + t;                        // one continuous sea across the whole film
  const n = (k: string) => sc[k] as number;
  const boltTimes = (sc.bolts as number[] | undefined) ?? [];
  const flash = flashAt(t, boltTimes);
  const bolts = boltTimes.map((b, i) => ({ seed: i * 7 + (sc.start as number), pos: [(-30 + i * 37) % 60, 70, -140] as V3, on: t > b && t < b + 0.16 ? 1 : 0 }));
  let storm = 1, clear = 0, rain = 1;
  let cam: { pos: V3; look: V3; fov: number; roll?: number } = { pos: [0, 3, 10], look: [0, 1, 0], fov: 45 };
  const crewIn = (react: number) => CREW.map((c, i) => {
    const p: V3 = [i % 2 ? 0.62 : -0.62, 0.3, -1.6 + i * 1.05];
    return <Robed key={i} pos={p} rotY={Math.PI + (i % 2 ? -0.3 : 0.3)} t={T + i} robe={c.robe} scale={0.92} lean={-0.25 * react} arms={react > 0.3 ? { l: [-0.3, 1.55 + 0.2 * react, 0.25], r: [0.3, 1.5 + 0.25 * react, 0.3] } : { l: [-0.25, 1.0, 0.25], r: [0.25, 1.0, 0.25] }} />;
  });
  let scene: React.ReactNode = null;
  const over: React.ReactNode[] = [];
  if (id === "s1") {
    const k = ease(clamp01(t / d));
    cam = { pos: lerp3([-10, 5.2, 12], [-6.2, 3.4, 7.4], k), look: [0, 1.2, 0], fov: 40, roll: Math.sin(t * 0.8) * 0.02 };
    scene = <Boat t={T} storm={storm} pos={[0, 0, 0]} rotY={0.5} crew={crewIn(0)} />;
    over.push(<Title key="tt" text={"A MIRACLE THAT\nDEFIED NATURE..."} from={0.6} to={6.2} top={1260} size={66} />);
  } else if (id === "s2") {
    storm = 0.7;
    const k = ease(clamp01(t / d));
    const jz = -26 + t * 0.6;
    const jp = on([0, 0, jz], T, storm);
    const cz = jz + 7 - 3.2 * k;
    cam = { pos: [0.9 - 0.5 * k, Math.max(jp[1], waveH(0.5, cz, T, storm)) + 1.0 + 0.3 * k, cz], look: [0, jp[1] + 1.2, jz], fov: 38, roll: Math.sin(t * 0.9) * 0.015 };
    scene = <Robed pos={jp} t={T} {...JESUS} walk={1} glow={1} wind={1.4} />;
  } else if (id === "s3") {
    storm = 0.75;
    const react = sm(0.6, 1.8, t);
    const boatY = waveH(0, 0, T, storm) * 0.85 + 0.15;
    const jz = -15 + t * 0.4, jp = on([0.8, 0, jz], T, storm);
    cam = { pos: [0.05, boatY + 2.9 + Math.sin(T * 1.7) * 0.05, 3.9], look: [0.6, jp[1] + 1.0, jz], fov: 44, roll: (waveH(-1, 0, T, storm) - waveH(1, 0, T, storm)) * 0.06 };
    scene = (
      <>
        <Boat t={T} storm={storm} pos={[0, 0, 0]} rotY={0} crew={crewIn(react)} />
        <Robed pos={jp} t={T} {...JESUS} walk={1} glow={1.3} wind={1.4} arms={t > n("speakAt") ? { r: [0.32, 1.25, 0.35] } : {}} />
      </>
    );
  } else if (id === "s4") {
    storm = 0.6;
    const step = n("stepAt"), wind = n("windAt"), sink = n("sinkAt");
    const out = sm(step, step + 1.2, t);
    const walkK = sm(step + 1.0, wind, t);
    const pz = -3.3 - out * 0.8 - walkK * 2.2;
    const down = sm(sink, sink + 1.4, t) * 0.95;
    const surf = waveH(0, pz, T, storm) * 0.95;
    const boatBow = waveH(0, -3, T, storm) * 0.85 + 0.9;
    const py = out < 1 ? boatBow * (1 - out) + surf * out + Math.sin(out * Math.PI) * 0.3 : surf - down;
    const fear = sm(wind, wind + 0.8, t);
    const jp = on([0, 0, -8.6], T, storm);
    rain = 1 + fear * 0.8;
    cam = { pos: lerp3([1.7, 2.9, -0.4], [1.3, 2.4, -2.4], ease(clamp01(t / d))), look: [0, 1.0 + surf * 0.4, -8.2], fov: 44, roll: Math.sin(t * 0.7) * 0.015 };
    scene = (
      <>
        <Boat t={T} storm={storm} pos={[0, 0, 0]} rotY={0} crew={crewIn(0.5)} />
        <Robed pos={[0, py, pz]} rotY={Math.PI} t={T} {...PETER} walk={walkK > 0 && walkK < 1 ? 1 : 0} lean={0.15 * fear} wind={1 + fear} arms={down > 0.1 ? { l: [-0.3, 1.85, 0.45], r: [0.3, 1.9, 0.45] } : fear > 0.3 ? { l: [-0.45, 1.3, 0.2], r: [0.45, 1.3, 0.2] } : {}} />
        <Robed pos={jp} t={T} {...JESUS} glow={1.2} wind={1.3} />
      </>
    );
  } else if (id === "s5") {
    const g = n("grabAt");
    const reach = sm(0, g, t), lift = sm(g, g + 1.6, t);
    storm = 0.6 - 0.15 * lift; rain = 1 - 0.4 * lift;
    const jp = on([0, 0, -8.1], T, storm);
    const surf = waveH(0, -6.9, T, storm) * 0.95;
    const py = surf - 0.95 * (1 - lift);
    cam = { pos: lerp3([3.4, 2.0, -4.6], [2.7, 1.8, -5.4], ease(clamp01(t / d))), look: [0, 1.1 + surf * 0.5, -7.5], fov: 38, roll: Math.sin(t * 0.6) * 0.012 };
    const hand: V3 = [0.12, 1.15 + 0.35 * (1 - lift), 0.25 + 0.5 * reach];
    scene = (
      <>
        <Robed pos={jp} t={T} {...JESUS} glow={1.4} wind={1.2} lean={0.12 * reach * (1 - lift)} arms={{ r: hand }} />
        <Robed pos={[0, py, -6.9]} rotY={Math.PI} t={T} {...PETER} wind={1.5} arms={{ l: [-0.15, 1.85 - 0.55 * lift, 0.45], r: [-0.12, 1.85 - 0.5 * lift, 0.5] }} />
      </>
    );
  } else {
    const k = ease(clamp01(t / d));
    storm = 0.45 - 0.3 * k; clear = sm(0.2, d, t); rain = Math.max(0, 0.5 - k);
    const jp = on([0, 0, -8.1], T, storm), pp = on([0.5, 0, -7.7], T, storm);
    cam = { pos: lerp3([2.4, 1.6, -4.4], [7, 7.5, 5], k), look: [0, 1.3, -7.9], fov: 40 };
    scene = (
      <>
        <Boat t={T} storm={storm} pos={[0, 0, 0]} rotY={0} crew={crewIn(0)} />
        <Robed pos={jp} t={T} {...JESUS} glow={1.4} wind={0.5} arms={{ r: [0.45, 1.25, 0.15] }} />
        <Robed pos={pp} rotY={-0.4} t={T} {...PETER} wind={0.6} />
      </>
    );
    over.push(<Title key="tt" text={"HAVE FAITH.\nDO NOT FEAR."} from={d - 4.6} to={d + 1} top={1250} size={74} />);
  }
  const fadeIn = interpolate(t, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = id === "s6" ? interpolate(t, [d - 1.0, d], [1, 0], { extrapolateLeft: "clamp" }) : interpolate(t, [d - 0.3, d], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
        <Canvas3D exposure={1.35}>
          <Cam pos={cam.pos} look={cam.look} fov={cam.fov} roll={cam.roll ?? 0} />
          <World t={T} storm={storm} flash={flash} bolts={bolts} clear={clear} rain={rain} camC={cam.pos}>{scene}</World>
        </Canvas3D>
        <Grade strength={0.7} />
      </AbsoluteFill>
      <div style={{ whiteSpace: "pre-line" }}>{over}</div>
    </AbsoluteFill>
  );
};
