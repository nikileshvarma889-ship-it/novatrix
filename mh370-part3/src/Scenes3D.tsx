import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { Easing, useVideoConfig } from "remotion";
import { Airport } from "./three/Airport";
import { B777, lightsAt } from "./three/B777";
import { AtcRoom, RoomFx } from "./three/AtcRoom";
import { Glow, LightField } from "./three/Lights";
import { CloudLayer, Mood, MoodFog, Ocean, SkyDome } from "./three/World";
import { useMoodEnv } from "./three/env";
import type { OceanState } from "./oceanDisplay";

const ease = Easing.bezier(0.42, 0, 0.3, 1);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k) as [number, number, number];

export const NIGHT: Record<string, Mood> = {
  // airport at night: sodium glow of the city on the low cloud base
  airport: { sky: "#06090f", horizon: "#2a2522", fog: "#151618", sun: new THREE.Vector3(0.5, 0.45, -0.7), sunColor: "#9db3d6", sunI: 0.5, storm: 0.25 },
  // cruise at 35,000 ft: clear dark sky, moonlit cloud deck far below
  cruise: { sky: "#03060c", horizon: "#16202e", fog: "#0e1520", sun: new THREE.Vector3(-0.6, 0.35, 0.5), sunColor: "#b8c8e6", sunI: 0.75, storm: 0.0 },
  // the open ocean before dawn: fog and darkness
  ocean: { sky: "#05080c", horizon: "#151c24", fog: "#11171e", sun: new THREE.Vector3(0.2, 0.3, -0.8), sunColor: "#6f819c", sunI: 0.3, storm: 0.55 },
};

const Cam: React.FC<{ pos: [number, number, number]; look: [number, number, number]; fov?: number; roll?: number }> = ({ pos, look, fov = 40, roll = 0 }) => {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  cam.position.set(...pos);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(...look);
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  return null;
};

export const Canvas3D: React.FC<{ children: React.ReactNode; exposure?: number }> = ({ children, exposure = 1.2 }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposure }} camera={{ fov: 40, near: 0.05, far: 12000, position: [0, 2, 10] }} style={{ background: "#000" }}>
      {children}
    </ThreeCanvas>
  );
};

/** Stars on the upper sky (fixed seed). */
const Stars: React.FC<{ t: number; count?: number; intensity?: number }> = ({ t, count = 900, intensity = 1 }) => {
  const pts = useMemo(() => {
    let s = 77;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: count }, () => {
      const a = r() * Math.PI * 2, el = Math.asin(0.05 + r() * 0.95);
      return [Math.cos(a) * Math.cos(el) * 3500, Math.sin(el) * 3500, Math.sin(a) * Math.cos(el) * 3500] as [number, number, number];
    });
  }, [count]);
  return <LightField points={pts} color="#dfe8ff" size={2.2} minPx={2.2} intensity={0.75 * intensity} twinkle={0.5} t={t} />;
};

// ------------------------------------------------------------------ the control room
export type Shot = "wide" | "screen" | "profile" | "mic" | "radio" | "back";
/** Camera set-ups in the room (metres). The controller's head is at about (-0.05, 1.45, 0.73), the main screen at (0, 1.32, -0.3). */
function roomCam(shot: Shot, k: number, shake: number): React.ReactNode {
  switch (shot) {
    case "wide": return <Cam pos={lerp3([1.3, 1.8, 3.1], [0.6, 1.6, 1.9], k)} look={[-0.05, 1.2, -0.3]} fov={44} roll={shake} />;
    case "screen": return <Cam pos={lerp3([0.4, 1.55, 1.5], [0.08, 1.38, 0.55], k)} look={[0, 1.32, -0.3]} fov={40} roll={shake} />;
    case "profile": return <Cam pos={lerp3([-0.62, 1.5, 1.62], [-0.5, 1.47, 1.38], k)} look={[-0.02, 1.38, 0.2]} fov={30} roll={shake} />;
    case "mic": return <Cam pos={lerp3([0.75, 1.45, 1.85], [0.62, 1.42, 1.6], k)} look={[-0.05, 1.3, 0.3]} fov={34} roll={shake} />;
    case "radio": return <Cam pos={[-0.4 + shake * 0.5, 1.2, 0.55]} look={[-0.56, 0.86, -0.1]} fov={64 - 6 * k} />;
    default: return <Cam pos={lerp3([-0.7, 1.55, 1.95], [-0.6, 1.52, 1.75], k)} look={[-0.05, 1.42, 0.5]} fov={34} roll={shake} />;
  }
}

export const Room: React.FC<{ t: number; shot: Shot; k: number; radar: OceanState; fx: RoomFx; shake?: number }> = ({ t, shot, k, radar, fx, shake = 0 }) => (
  <>
    {roomCam(shot, ease(clamp01(k)), shake)}
    <color attach="background" args={["#010204"]} />
    <AtcRoom t={t} radar={radar} {...fx} />
  </>
);

// ------------------------------------------------------------------ the runway in fog
const FOGGY: Mood = { sky: "#0b1018", horizon: "#2a323d", fog: "#252d37", sun: new THREE.Vector3(0.3, 0.5, -0.6), sunColor: "#8193ad", sunI: 0.3, storm: 0.3 };
const cam0 = (mode: "dolly" | "final", t: number): [number, number, number] => (mode === "dolly" ? [-1825 + t * 9, 2.2, -6] : [-1960, 1.4, 14]);
export const Runway: React.FC<{ t: number; dur: number; mode: "dolly" | "final"; lights: number; shadowAt?: number }> = ({ t, dur, mode, lights, shadowAt = 0 }) => {
  const env = useMoodEnv(FOGGY);
  const k = clamp01(t / dur);
  let cam: React.ReactNode;
  if (mode === "dolly") cam = <Cam pos={[-1825 + t * 9, 2.2 + Math.sin(t * 0.6) * 0.05, -6]} look={[-1445 + t * 9, 1.6, -2]} fov={42} />;
  else cam = <Cam pos={[-1960, 1.4, 14]} look={[-1700, 26 + 30 * ease(k), 0]} fov={48} />;
  // the shadow: a dark 777 passing overhead inside the cloud, low and slow, then gone
  const st = t - shadowAt;
  const show = mode === "final" && st > -0.5 && st < 6;
  const ax = -2010 + st * 62;
  return (
    <>
      {cam}
      <SkyDome mood={FOGGY} t={t} />
      <MoodFog mood={FOGGY} density={0.008} />
      <ambientLight intensity={0.18} color="#36465c" />
      <hemisphereLight args={["#2a3646", "#07090b", 0.25]} />
      <Airport t={t} env={env} lights={lights} fog={0.0035} city={false} />
      {lights > 0.5 ? <pointLight position={[cam0(mode, t)[0] + 40, 6, 0]} intensity={45 * lights} distance={60} decay={1.6} color="#fff0d8" /> : null}
      <CloudLayer mood={FOGGY} t={t} count={36} seed={31} center={[-1700, 9, 0]} area={[700, 10, 160]} size={[60, 140]} opacity={0.5} drift={[1.5, 0, 0.4]} />
      <CloudLayer mood={FOGGY} t={t} count={26} seed={32} center={[-1650, 110, 0]} area={[900, 40, 400]} size={[200, 420]} opacity={0.6} drift={[3, 0, 0]} />
      {show ? (
        <group position={[ax, 95, 10]} rotation={[0, 0, -0.06]}>
          <B777 env={null} gear={1} lights={{ ...lightsAt(st), landing: 0, cabin: 0, strobe: 0, nav: 0.25 }} scaleGlow={2} />
        </group>
      ) : null}
    </>
  );
};
