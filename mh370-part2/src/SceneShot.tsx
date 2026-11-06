import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { Canvas3D, S1, S3 } from "./Scenes3D";
import { Caption, Glitch, Grade, Line, Subtitles } from "./Overlays";
import { EndCard, OpenTitle, RadarShot } from "./Shots2D";
import type { OceanState } from "./oceanDisplay";

type Sc = (typeof timeline.scenes)[number] & Record<string, unknown>;
export const SCENES = timeline.scenes as unknown as Sc[];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => x * x * (3 - 2 * x);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const myt = (s: number) => {
  const m = Math.floor(s / 60), x = Math.floor(s % 60);
  return `00:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")} MYT`;
};
const GHOST_POS: [number, number] = [95.6, -30.4];
const base = (t: number): OceanState => ({
  t, mode: "radar", header: "KL ACC · SECTOR 3", clock: myt(13 + t), view: { lon: 101.5, lat: 3.5, span: 24 },
  arc: 0, area: 0, unknown: 0, ghost: 0, ghostLabel: 0, ghostPos: GHOST_POS, track: [], glitch: 0,
});

/** One scene in scene-local time: the shot, grade, captions, subtitles, static-glitch transitions. */
export const SceneShot: React.FC<{ id: string }> = ({ id }) => {
  const sc = SCENES.find((s) => s.id === id)!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const d = sc.dur as number;
  const lines = sc.lines as unknown as Line[];
  const L = (i: number) => [lines[i].start, lines[i].start + lines[i].dur] as [number, number];
  let shot: React.ReactNode = null;
  let inner: number[] = [];
  const caps: React.ReactNode[] = [];
  if (id === "s1") {
    const cut = sc.cut as number;
    shot = <Canvas3D exposure={1.45}><S1 t={t} dur={d} cut={cut} /></Canvas3D>;
    inner = [cut];
    caps.push(<OpenTitle key="ot" from={0.2} to={3.4} title={timeline.title} part={timeline.part} />);
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={3.5} to={cut - 0.2} />);
    caps.push(<Caption key="c2" lines={["26 COUNTRIES JOINED THE SEARCH"]} from={cut + 0.4} to={d - 0.4} />);
  } else if (id === "s2") {
    const [a0, a1] = L(0), [u0] = L(1), [k0] = L(2);
    const z = ease(clamp01(t / (a1 + 0.5)));
    const state: OceanState = {
      ...base(t), mode: "map", header: "SATELLITE DATA · INMARSAT 3F1", clock: "8 MAR 2014",
      view: { lon: mix(101, 102.5, z), lat: mix(-4, -21, z), span: mix(34, 55, z) },
      arc: clamp01((t - a0 - 0.6) / 2.8), area: clamp01((t - a1 + 0.3) / 0.8), unknown: clamp01((t - u0 - 0.5) / 0.6),
    };
    shot = <RadarShot state={state} zoom={1 + 0.06 * clamp01(t / d)} focus={[0.5, 0.55]} />;
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={0.4} to={a1} />);
    caps.push(<Caption key="c2" lines={["120,000 KM² OF SEAFLOOR SEARCHED", "2014 – 2017"]} from={a1 + 0.1} to={k0 - 0.1} />);
    caps.push(<Caption key="c3" lines={["EXACT LOCATION: UNKNOWN"]} from={k0} to={d - 0.3} />);
  } else if (id === "s3") {
    const ghosts = lines.map((l, i) => (l.who === "GHOST" ? L(i) : null)).filter(Boolean) as [number, number][];
    const ctrlI = lines.findIndex((l) => l.who === "CTRL");
    const frozeI = lines.findIndex((l) => /froze/.test(l.text));
    const shots = ghosts.map(([a, b]) => [a - 0.45, b + 0.5] as [number, number]);
    const radar: OceanState = { ...base(t), glitch: ghosts.some(([a, b]) => t > a && t < b + 0.5) ? 0.8 : 0 };
    shot = <Canvas3D exposure={1.35}><S3 t={t} dur={d} radar={radar} shots={shots} ghost={ghosts} ctrl={L(ctrlI)} freezeAt={lines[frozeI].start} /></Canvas3D>;
    inner = shots.flat();
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={0.4} to={Math.min(L(0)[1], 5.5)} />);
    caps.push(<Caption key="c2" lines={["MIDNIGHT · KUALA LUMPUR ATC", "FICTION"]} from={Math.min(L(0)[1], 5.5) + 0.2} to={shots[0][0] - 0.1} />);
  } else if (id === "s4") {
    const [s0] = L(0), [f0] = L(1), [m0, m1] = L(2), [, i1] = L(3), [p0, p1] = L(4), [g0] = L(5), [w0] = L(6);
    const appear = s0 + lines[0].dur * 0.55;
    const zo = ease(clamp01((t - s0) / 2.4));
    const zi = ease(clamp01((t - m0) / (m1 - m0 + 0.5)));
    const gone = g0 + 0.55;
    const stepT = Math.max(0, t - gone);
    const track: [number, number][] = t > gone + 0.3 ? Array.from({ length: Math.min(14, Math.floor(stepT / 0.45) + 1) }, (_, i) => {
      const q = i * 0.45;
      return [GHOST_POS[0] + q * 0.32, GHOST_POS[1] + q * 0.95] as [number, number];
    }) : [];
    const state: OceanState = {
      ...base(t),
      view: { lon: mix(101.5, 99, zo), lat: mix(3.5, -21, zo) - zi * 5, span: mix(24, 50, zo) - zi * 14 },
      ghost: t < gone ? clamp01((t - appear) / 0.3) : 0,
      ghostLabel: t > f0 + 0.6 ? 1 : 0,
      glitch: t > p0 && t < p1 + 0.4 ? 0.9 : t > gone - 0.1 && t < gone + 0.3 ? 1 : 0,
      track,
    };
    shot = <RadarShot state={state} zoom={1 + 0.05 * clamp01(t / d)} focus={[0.5, 0.5]} shake={t > p0 && t < p1 ? 0.6 : t > gone - 0.1 && t < gone + 0.3 ? 1 : 0} />;
    inner = [gone];
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={0.3} to={appear} />);
    caps.push(<Caption key="c2" lines={["UNKNOWN AIRCRAFT · FICTION", "SOUTHERN INDIAN OCEAN"]} from={appear + 0.2} to={i1} />);
    caps.push(<Caption key="c3" lines={["SIGNAL LOST · FICTION"]} from={gone + 0.2} to={w0 - 0.1} />);
    caps.push(<Caption key="c4" lines={["TARGET STILL MOVING · FICTION"]} from={w0 + 0.5} to={d - 0.3} />);
  } else {
    shot = <EndCard notes={sc.end as string[]} next={timeline.next} cta={timeline.cta} />;
  }
  const fadeIn = interpolate(t, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(t, [d - 0.3, d], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
        {shot}
        {id !== "s5" ? <Grade /> : null}
      </AbsoluteFill>
      {caps}
      {lines.length ? <Subtitles lines={lines} /> : null}
      {id !== "s5" ? <Glitch at={0} len={0.4} /> : null}
      {inner.map((c) => <Glitch key={c} at={c} len={0.3} strength={0.8} />)}
      {id !== "s5" ? <Glitch at={d} len={0.35} /> : null}
    </AbsoluteFill>
  );
};
