import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { Canvas3D, S1, S2, S4 } from "./Scenes3D";
import { Caption, Glitch, Grade, Line, Subtitles } from "./Overlays";
import { EndCard, OpenTitle, RadarShot } from "./Shots2D";

type Sc = (typeof timeline.scenes)[number] & Record<string, unknown>;
export const SCENES = timeline.scenes as unknown as Sc[];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const hms = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}Z`;
};
const UTC = (h: number, m: number, s: number) => h * 3600 + m * 60 + s;

/** One scene in scene-local time: the shot, grade, captions, subtitles, static-glitch transitions. */
export const SceneShot: React.FC<{ id: string }> = ({ id }) => {
  const sc = SCENES.find((s) => s.id === id)!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const d = sc.dur as number;
  const lines = sc.lines as unknown as Line[];
  const n = (k: string) => sc[k] as number;
  let shot: React.ReactNode = null;
  let inner: number[] = [];
  const caps: React.ReactNode[] = [];
  if (id === "s1") {
    shot = <Canvas3D exposure={1.35}><S1 t={t} dur={d} cut={n("cut")} /></Canvas3D>;
    inner = [n("cut")];
    caps.push(<OpenTitle key="ot" from={0.3} to={3.7} title={timeline.title} part={timeline.part} />);
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={3.9} to={Math.min(d - 0.5, 9.2)} />);
  } else if (id === "s2") {
    const cuts = sc.cuts as [number, number];
    const reply = lines[1].start;                                    // pilot reply logged at 17:19:30 UTC (01:19:30 MYT)
    const clock = (x: number) => hms(UTC(17, 19, 30) + (x - reply));
    shot = <Canvas3D exposure={1.3}><S2 t={t} dur={d} cuts={cuts} atcTalk={[lines[0].start, lines[0].start + lines[0].dur]} pilotTalk={[lines[1].start, lines[1].start + lines[1].dur]} clock={clock} /></Canvas3D>;
    inner = cuts;
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={0.4} to={cuts[0] - 0.2} />);
    caps.push(<Caption key="c2" lines={["01:19:30 MYT", "LAST RADIO CONTACT"]} from={cuts[1] + 0.2} to={d - 0.4} />);
  } else if (id === "s3") {
    const coast = n("coastAt"), gone = n("goneAt"), trail = n("trailAt");
    // transponder lost 17:20:31Z, target dropped from the display 17:21:13Z (compressed in between)
    const clockS = t < coast ? UTC(17, 20, 31) - (coast - t) : t < gone ? UTC(17, 20, 31) + 42 * (t - coast) / (gone - coast) : UTC(17, 21, 13) + (t - gone);
    const target = t < coast ? "live" : t < gone ? "coast" : "gone";
    const zoomIn = 1 + 0.5 * clamp01(t / gone);
    const zoomOut = interpolate(t, [trail, trail + 2.2], [zoomIn, 1.0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    shot = (
      <RadarShot
        state={{ t, clock: hms(clockS), progress: Math.min(1, 0.955 + 0.045 * clamp01(t / coast)), target: target as "live", trail: clamp01((t - trail - 0.4) / (d - trail - 1.2)), traffic: true }}
        zoom={t < trail ? zoomIn : zoomOut}
        focus={[0.62, 0.36]}
        shake={t > gone - 0.1 && t < gone + 0.25 ? 1 : 0}
      />
    );
    inner = [gone];
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={0.4} to={coast - 0.1} />);
    caps.push(<Caption key="c2" lines={["01:20:31 MYT", "TRANSPONDER SIGNAL LOST"]} from={coast} to={gone - 0.1} />);
    caps.push(<Caption key="c3" lines={["01:21:13 MYT", "GONE FROM ATC RADAR"]} from={gone + 0.2} to={trail - 0.1} />);
    caps.push(<Caption key="c4" lines={["MILITARY RADAR KEPT TRACKING IT", "TURNING BACK WEST · TRACK APPROXIMATE"]} from={trail + 0.3} to={d - 0.3} />);
  } else if (id === "s4") {
    shot = <Canvas3D exposure={1.4}><S4 t={t} dur={d} lightAt={n("lightAt")} fadeAt={n("fadeAt")} /></Canvas3D>;
    caps.push(<Caption key="c" lines={sc.caption as string[]} from={n("lightAt") - 0.3} to={d - 0.5} />);
  } else {
    shot = <EndCard notes={sc.end as string[]} next={timeline.next} cta={timeline.cta} />;
  }
  const fadeIn = interpolate(t, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = id === "s4" ? 1 : interpolate(t, [d - 0.3, d], [1, 0], { extrapolateLeft: "clamp" });
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
      {id !== "s4" && id !== "s5" ? <Glitch at={d} len={0.35} /> : null}
    </AbsoluteFill>
  );
};
