import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { Canvas3D, S1, S2, S3, S4, S5, S6, S7 } from "./Scenes3D";
import { Caption, Glitch, Grade, Line, Rain, Subtitles, TitleCard } from "./Overlays";

type Sc = (typeof timeline.scenes)[number] & { cut?: number; ghostAt?: number; scopeAt?: number; cuts?: [number, number]; wake?: number; lightning?: number[] };
export const SCENES = timeline.scenes as unknown as Sc[];

/** One scene, in scene-local time: the 3D shot, overlays, a static-glitch in and out. */
export const SceneShot: React.FC<{ id: string }> = ({ id }) => {
  const sc = SCENES.find((s) => s.id === id)!;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const d = sc.dur;
  let shot: React.ReactNode;
  switch (id) {
    case "s1": shot = <S1 t={t} dur={d} />; break;
    case "s2": shot = <S2 t={t} dur={d} />; break;
    case "s3": shot = <S3 t={t} dur={d} cut={sc.cut!} />; break;
    case "s4": shot = <S4 t={t} dur={d} lightningAt={sc.lightning!} />; break;
    case "s5": shot = <S5 t={t} dur={d} scopeAt={sc.scopeAt!} ghostAt={sc.ghostAt!} lightningAt={sc.lightning!} />; break;
    case "s6": shot = <S6 t={t} dur={d} cuts={sc.cuts!} lightningAt={sc.lightning!} />; break;
    default: shot = <S7 t={t} dur={d} wake={sc.wake!} />;
  }
  const inner: number[] = [sc.cut, sc.scopeAt, ...(sc.cuts ?? [])].filter((x): x is number => typeof x === "number");
  const fadeIn = interpolate(t, [0, 0.35], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(t, [d - 0.3, d], [1, 0], { extrapolateLeft: "clamp" });
  const ghostLine = sc.lines.find((l) => l.who === "GHOST");
  const titleAt = id === "s7" && ghostLine ? ghostLine.start + ghostLine.dur + 0.4 : null;
  const rain = id === "s5" ? (t < (sc.scopeAt ?? d) ? 1 : 0) : id === "s6" ? (t < (sc.cuts?.[0] ?? 0) ? 1.2 : 0) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
        <Canvas3D>{shot}</Canvas3D>
        {rain ? <Rain amount={rain} /> : null}
        <Grade />
      </AbsoluteFill>
      <Caption lines={sc.caption} from={0.4} to={Math.min(d - 0.5, 0.4 + 4.8)} />
      {(sc as { beat?: string[] }).beat?.length ? <Caption lines={(sc as { beat: string[] }).beat} from={(sc as { beatAt: number }).beatAt} to={(sc.scopeAt ?? d) - 0.15} /> : null}
      {(sc as { toll?: string[]; tollAt?: number }).toll?.length ? <Caption lines={(sc as { toll: string[] }).toll} from={(sc as { tollAt: number }).tollAt} to={d - 0.2} /> : null}
      <Subtitles lines={sc.lines as unknown as Line[]} />
      {titleAt !== null ? <TitleCard from={titleAt} title={timeline.title} notes={sc.end} /> : null}
      <Glitch at={0} len={0.4} />
      {inner.map((c) => <Glitch key={c} at={c} len={0.3} strength={0.8} />)}
      <Glitch at={d} len={0.35} />
    </AbsoluteFill>
  );
};
