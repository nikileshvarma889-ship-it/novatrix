import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { Canvas3D, Room, Runway, Shot } from "./Scenes3D";
import { Caption, Glitch, Grade, Line, Subtitles } from "./Overlays";
import { FinalCard, OpenTitle, RadarShot } from "./Shots2D";
import { onFinal, KLIA, type OceanState } from "./oceanDisplay";
import type { RoomFx } from "./three/AtcRoom";

type Sc = (typeof timeline.scenes)[number] & Record<string, unknown>;
export const SCENES = timeline.scenes as unknown as Sc[];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const myt = (s: number) => `00:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")} MYT`;

/** The inbound target's distance (degrees from KLIA along the approach) through the film, by scene. */
const radarAt = (t: number, sceneStart: number, d: number, extra: Partial<OceanState> = {}): OceanState => ({
  t, mode: "radar", header: "KL APPROACH · RADAR 2", clock: myt(41 + sceneStart + t),
  view: { lon: KLIA[0] - 0.25, lat: KLIA[1] + 0.35, span: 2.6 },
  arc: 0, area: 0, unknown: 0, ghost: 1, ghostLabel: 1, ghostPos: onFinal(d), track: [], glitch: 0, airport: true, label: ["MAS370", "--- ---"],
  ...extra,
});

/** One scene in scene-local time: the shot(s), grade, captions, subtitles, static-glitch transitions. */
export const SceneShot: React.FC<{ id: string }> = ({ id }) => {
  const sc = SCENES.find((s) => s.id === id)!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const d = sc.dur as number;
  const st = sc.start as number;
  const lines = sc.lines as unknown as Line[];
  const L = (i: number) => [lines[i].start, lines[i].start + lines[i].dur] as [number, number];
  let shot: React.ReactNode = null;
  let inner: number[] = [];
  const caps: React.ReactNode[] = [];
  const room = (s: Shot, k: number, radar: OceanState, fx: RoomFx, exposure = 1.35, shake = 0) => (
    <Canvas3D exposure={exposure}><Room t={t} shot={s} k={k} radar={radar} fx={fx} shake={shake} /></Canvas3D>
  );
  if (id === "s1") {
    const [a0, a1] = L(0);
    const appear = a0 + (a1 - a0) * 0.78;                                      // on "...returned."
    const radar = radarAt(t, st, 1.3, { ghost: t > appear ? 1 : 0, glitch: t < 1.6 ? 0.8 : t > appear - 0.1 && t < appear + 0.4 ? 1 : 0 });
    shot = room("wide", t / d, radar, { flicker: t < 1.6 ? 0.8 : t > appear && t < appear + 0.5 ? 0.6 : 0 });
    inner = [appear];
    caps.push(<OpenTitle key="ot" from={0.3} to={3.0} title={timeline.title} part={timeline.part} />);
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={3.1} to={d - 0.3} />);
  } else if (id === "s2") {
    const [a0, a1] = L(0);
    const cut = a0 + (a1 - a0) * 0.5;
    if (t < cut) {
      const k = t / cut;
      shot = <RadarShot state={radarAt(t, st, mix(1.25, 1.08, k), { view: { lon: KLIA[0] - 0.3, lat: KLIA[1] + 0.5, span: mix(2.6, 2.0, k) } })} zoom={1 + 0.08 * k} focus={[0.5, 0.45]} />;
    } else {
      shot = room("profile", (t - cut) / (d - cut), radarAt(t, st, mix(1.08, 0.95, (t - cut) / (d - cut))), { freeze: 1, look: 0 }, 1.5);
    }
    inner = [cut];
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={0.4} to={cut - 0.2} />);
  } else if (id === "s3") {
    const [c0] = L(0), [g0, g1] = L(1);
    const cut = g0 - 0.35;
    const fx: RoomFx = { mic: clamp01((t - 0.2) / 1.6), talk: t > c0 && t < L(0)[1] ? 1 : 0, freeze: 1, flicker: t > cut ? 0.5 : 0, rx: t > g0 - 0.2 && t < g1 + 0.3 ? 1 : 0 };
    const radar = radarAt(t, st, mix(0.95, 0.8, t / d), { glitch: t > g0 && t < g1 ? 0.7 : 0 });
    shot = t < cut ? room("mic", t / cut, radar, fx) : room("radio", (t - cut) / (d - cut), radar, fx, 1.35, 0.004 * Math.sin(t * 40));
    inner = [cut];
  } else if (id === "s4") {
    shot = <Canvas3D exposure={1.5}><Runway t={t} dur={d} mode="dolly" lights={1} /></Canvas3D>;
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={0.4} to={L(0)[0] + 2} />);
  } else if (id === "s5") {
    const [g0, g1] = L(0);
    const cut = g0 - 0.3;
    const radar = radarAt(t, st, mix(0.55, 0.2, t / d), { glitch: t > g0 && t < g1 + 0.2 ? 0.8 : 0 });
    shot = t < cut ? room("screen", t / cut, radar, { freeze: 1, mic: 1 }) : room("radio", (t - cut) / (d - cut), radar, { freeze: 1, mic: 1, rx: t < g1 + 0.3 ? 1 : 0, flicker: t < g1 ? 0.6 : 0 });
    inner = [cut];
  } else if (id === "s6") {
    const [n0] = L(0);
    const vanish = n0 + 0.15;
    const cut = vanish + 2.3;
    const off = clamp01((t - vanish) / 1.6);
    const radar = radarAt(t, st, 0.15, { ghost: t < vanish ? 1 : 0, glitch: t > vanish - 0.1 && t < vanish + 0.4 ? 1 : 0, dark: off });
    const fx: RoomFx = { freeze: 1, mic: clamp01(1 - (t - vanish) / 1.2), screensOff: off, dim: off, headsetOff: clamp01((t - cut - 0.3) / 3.2) };
    shot = t < cut ? room("screen", 0.6 + 0.4 * (t / cut), radar, fx) : room("back", (t - cut) / (d - cut), radar, fx, 1.6);
    inner = [vanish, cut];
  } else if (id === "s7") {
    const fl = t < 2.2 ? 1 : t > d - 2.6 ? 0 : (Math.sin(t * 31) * Math.sin(t * 7.3) > 0.1 ? 1 : 0.15);
    shot = <Canvas3D exposure={1.5}><Runway t={t} dur={d} mode="final" lights={fl} shadowAt={1.2} /></Canvas3D>;
  } else {
    shot = <FinalCard notes={sc.end as string[]} />;
  }
  const fadeIn = interpolate(t, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = id === "s7" ? interpolate(t, [d - 2.2, d - 0.2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : interpolate(t, [d - 0.3, d], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
        {shot}
        {id !== "s8" ? <Grade /> : null}
      </AbsoluteFill>
      {caps}
      {lines.length ? <Subtitles lines={lines} /> : null}
      {id !== "s8" ? <Glitch at={0} len={0.4} /> : null}
      {inner.map((c) => <Glitch key={c} at={c} len={0.3} strength={0.8} />)}
      {id !== "s8" && id !== "s7" ? <Glitch at={d} len={0.35} /> : null}
    </AbsoluteFill>
  );
};
