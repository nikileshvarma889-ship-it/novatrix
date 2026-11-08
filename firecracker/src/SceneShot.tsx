import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { Canvas3D, SLOW, S1, S2, S3, S4a, S4b, S5, s2State } from "./Scenes3D";
import { Badge, Dip, Effects, EndCard, Gauge, Grade, Label, Scene, Subtitles, Tag, Title } from "./Overlays";
import { FC, FC_BASE, V3, camS1, camS2, camS3, camS4a, camS4b, clamp01, rocketY, ROCKET_X, HUB, WHEEL_R } from "./sim";
import { fusePoint } from "./three/Firecracker";

export const SCENES = timeline.scenes as unknown as Scene[];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export const SceneShot: React.FC<{ id: string }> = ({ id }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const s = SCENES.find((x) => x.id === id)!;
  const d = s.dur, e = s.ev, L = s.lines;
  const lineEnd = (i: number) => L[i].start + L[i].dur;
  let body: React.ReactNode = null, over: React.ReactNode = null, exposure = 1.0;

  if (id === "s1") {
    body = <S1 t={t} d={d} />;
    over = (
      <>
        <Title t={t} from={0.3} to={d - 0.2} />
        <Badge t={t} from={1.2} to={d - 0.3} top={1110} text="EDUCATIONAL ANIMATION · DON'T TRY THIS" color="#ffc14a" />
      </>
    );
  } else if (id === "s2") {
    const cam = camS2(t, d);
    const st = s2State(t, d, e.fuseStart, e.fuseEnd);
    body = <S2 t={t} d={d} fs={e.fuseStart} fe={e.fuseEnd} />;
    const tip = add(FC_BASE, fusePoint(1 - st.fuse));
    over = (
      <>
        <Tag t={t} n="01" title="INSIDE THE CASING" note="SIMPLIFIED CUTAWAY · NOT TO SCALE" to={d} />
        <Label t={t} cam={cam} at={add(FC_BASE, [-FC.R * 0.98, 1.6, 0.1])} text="PAPER CASING" sub="rolled, tightly sealed" side="left" y={700} from={1.0} to={d - 0.1} />
        <Label t={t} cam={cam} at={tip} text="FUSE" sub="carries the flame inside" side="right" y={560} from={0.9} to={e.fuseEnd + 0.4} color="#7fe08a" />
        <Label t={t} cam={cam} at={add(FC_BASE, [0.15, -0.9, 0.5])} text="ENERGETIC MATERIAL" sub="simplified — burns very fast" side="left" y={1080} from={L[0].start + 2.2} to={d - 0.1} />
        <Label t={t} cam={cam} at={add(FC_BASE, [0.1, 1.0, 0.45])} text="HOT GASES" sub="heat + gas released" side="left" y={900} from={e.fuseEnd + 0.9} to={d - 0.1} color="#ff8a3a" />
        <Gauge t={t} value={st.pressure} from={e.fuseEnd} to={d + 1} />
      </>
    );
  } else if (id === "s3") {
    const rup = e.rupture;
    const cam = camS3(t, d, rup);
    body = <S3 t={t} d={d} rup={rup} />;
    exposure = 1.0;
    const after = t - rup;
    const l1 = L[1];
    const at = (k: number) => l1.start + l1.dur * k;
    over = (
      <>
        <Tag t={t} n="02" title="THE RUPTURE" to={rup + 0.3} />
        <Badge t={t} from={0.3} to={d} top={330} text="● SLOW MOTION · VISUALISATION" color="#ff8a5a" />
        <Gauge t={t} value={after < 0 ? 0.78 + 0.22 * clamp01(t / rup) : Math.max(0, 1 - after * 1.5)} from={-1} to={rup + 0.9} burst={after > -0.8 && after < 0.6} />
        <Label t={t} cam={cam} at={add(FC_BASE, [FC.R * 1.15, 0.3, 0.1])} text="CASING STRETCHES" sub="pressure rises extremely fast" side="right" y={760} from={0.6} to={rup + 0.05} color="#ff6a2c" />
        <Label t={t} cam={cam} at={add(FC_BASE, [0, 1.5, 0])} text="BRIGHT FLASH" sub="light + heat" side="left" y={560} from={rup + 0.15} to={rup + 2.4} color="#ffe08a" />
        <Label t={t} cam={cam} at={add(FC_BASE, [1.4, 0.6, 0.5])} text="LOUD BANG" sub="sudden expansion of gas" side="right" y={600} from={at(0.22)} to={d - 0.1} />
        <Label t={t} cam={cam} at={add(FC_BASE, [-Math.min(6, 0.9 + 9 * Math.max(0, t - rup) * SLOW) * 0.72, Math.min(6, 0.9 + 9 * Math.max(0, t - rup) * SLOW) * 0.69, 0])} text="PRESSURE WAVE" sub="races outward through the air" side="left" y={820} from={at(0.45)} to={d - 0.1} color="#9fd0ff" />
        <Label t={t} cam={cam} at={add(FC_BASE, [1.8, -0.4, 2])} text="BURST" sub="hot gases, sparks, smoke, fragments" side="right" y={1010} from={at(0.72)} to={d - 0.1} color="#ff8a3a" />
      </>
    );
  } else if (id === "s4a") {
    const cam = camS4a(t, e.lift);
    body = <S4a t={t} ig={e.ignite} lift={e.lift} />;
    const ry = rocketY(t, e.lift);
    over = (
      <>
        <Tag t={t} n="03" title="WHY ROCKETS FLY" to={d} />
        <Label t={t} cam={cam} at={[-12, FC.L + 0.5, 0]} text="FIRECRACKER" sub="sealed: pressure has nowhere to go → bursts in place" side="left" y={700} from={0.2} to={e.lift + 1.4} color="#ff6a2c" />
        <Label t={t} cam={cam} at={[ROCKET_X, ry + 8, 1.4]} text="ROCKET" sub="open nozzle: gas escapes one way → it flies" side="right" y={560} from={0.4} to={e.lift + 1.4} color="#4ab4ff" />
        <Label t={t} cam={cam} at={[ROCKET_X - 5, ry + 13, 2]} text="THRUST ↑" sub="the push on the rocket" side="left" y={720} from={e.lift + 1.0} to={d - 0.1} color="#38e07a" />
        <Label t={t} cam={cam} at={[ROCKET_X, ry - 12, 2]} text="GASES ↓" sub="hot exhaust pushed down" side="right" y={1050} from={e.lift + 1.2} to={d - 0.1} color="#ff7a2e" />
      </>
    );
  } else if (id === "s4b") {
    const cam = camS4b(t, d);
    body = <S4b t={t} d={d} ig={e.ignite} />;
    over = (
      <>
        <Tag t={t} n="04" title="WHY SPINNERS TURN" to={d} />
        <Label t={t} cam={cam} at={[HUB[0] + 16 * Math.cos(1.2), HUB[1] + 16 * Math.sin(1.2), 3]} text="TURNING FORCE" sub="torque spins the wheel" side="right" y={560} from={e.ignite + 1.7} to={d - 0.1} color="#38e07a" />
        <Label t={t} cam={cam} at={[HUB[0] - WHEEL_R - 6, HUB[1] - 8, 2]} text="EXHAUST" sub="jets point sideways, along the rim" side="left" y={1040} from={e.ignite + 0.9} to={d - 0.1} color="#ff7a2e" />
      </>
    );
  } else if (id === "s5") {
    body = <S5 t={t} d={d} bursts={e.bursts} />;
    const l0 = L[0];
    over = (
      <>
        <Effects t={t} at={[l0.start + l0.dur * 0.48, l0.start + l0.dur * 0.7, l0.start + l0.dur * 0.86]} to={e.card + 0.4} />
        <EndCard t={t} from={e.card} />
      </>
    );
  }
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Canvas3D exposure={exposure}>{body}</Canvas3D>
      <Grade />
      {over}
      <Subtitles lines={L} />
      <Dip t={t} d={d} inLen={id === "s1" ? 0.6 : id === "s3" ? 0 : 0.2} outLen={id === "s2" ? 0 : id === "s5" ? 0.8 : 0.2} />
    </AbsoluteFill>
  );
};
