import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { Easing, useVideoConfig } from "remotion";
import { B777, lightsAt } from "./three/B777";
import { Airport } from "./three/Airport";
import { Cockpit777 } from "./three/Cockpit777";
import { AtcRoom } from "./three/AtcRoom";
import { Glow, LightField } from "./three/Lights";
import { CloudLayer, Mood, MoodFog, Ocean, SkyDome } from "./three/World";
import { useMoodEnv } from "./three/env";
import type { RadarState } from "./radarDisplay";

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

// ------------------------------------------------------------------ the takeoff roll and climb
export function takeoff(t: number) {
  const x0 = -420, v0 = 62, a = 3.2, tv = (85 - v0) / a;
  const x = t < tv ? x0 + v0 * t + 0.5 * a * t * t : x0 + v0 * tv + 0.5 * a * tv * tv + 85 * (t - tv);
  const tl = 5.2;
  const y = t < tl ? 5.7 : t < 6.7 ? 5.7 + 4 * (t - tl) ** 2 : 5.7 + 9 + 12 * (t - 6.7);
  const pitch = t < 4.2 ? 0 : t < 5.2 ? 0.14 * ease(t - 4.2) : 0.15;
  const gear = t < 8.5 ? 1 : clamp01(1 - (t - 8.5) / 2.2);
  return { x, y, pitch, gear };
}

export const S1: React.FC<{ t: number; dur: number; cut: number }> = ({ t, dur, cut }) => {
  const mood = NIGHT.airport;
  const env = useMoodEnv(mood);
  const p = takeoff(t);
  const L = lightsAt(t, t < 9 ? 1 : clamp01(1 - (t - 9) / 1.5));
  let cam: React.ReactNode;
  if (t < cut) {
    const k = ease(clamp01(t / cut));
    cam = <Cam pos={[330, 2.0 + k * 0.6, 78]} look={[p.x + 10, p.y + 1 + k * 3, 0]} fov={lerp(24, 30, k)} />;
  } else {
    const k = clamp01((t - cut) / (dur - cut));
    cam = <Cam pos={[540, 1.8, -42]} look={[p.x + 12, p.y + 3, 0]} fov={lerp(42, 50, k)} roll={-0.03} />;
  }
  return (
    <>
      {cam}
      <SkyDome mood={mood} t={t} />
      <Stars t={t} count={500} intensity={0.5} />
      <MoodFog mood={mood} density={0.00045} />
      <ambientLight intensity={0.22} color="#5c6f8c" />
      <directionalLight position={[300, 400, -500]} intensity={0.55} color={mood.sunColor} />
      <hemisphereLight args={["#40506a", "#1c1610", 0.35]} />
      <Airport t={t} env={env} />
      <group position={[p.x, p.y, 0]} rotation={[0, 0, p.pitch]}>
        <B777 env={env} gear={p.gear} lights={L} scaleGlow={1.4} />
        {/* landing-light wash on the runway ahead */}
        {p.y < 40 ? <pointLight position={[40, -4, 0]} intensity={L.landing * 3500} distance={160} decay={1.6} color="#fff4dc" /> : null}
        {t < cut ? <pointLight position={[2, -8, 0]} intensity={600} distance={60} decay={1.6} color="#ffd9a8" /> : null}
      </group>
      <CloudLayer mood={mood} t={t} count={26} seed={4} center={[600, 420, -200]} area={[3000, 60, 2400]} size={[500, 900]} opacity={0.5} />
    </>
  );
};

// ------------------------------------------------------------------ last radio call: ATC room, cockpit, exterior
export const S2: React.FC<{ t: number; dur: number; cuts: [number, number]; atcTalk: [number, number]; pilotTalk: [number, number]; clock: (t: number) => string }> = ({ t, dur, cuts, atcTalk, pilotTalk, clock }) => {
  const env = useMoodEnv(NIGHT.cruise);
  if (t < cuts[0]) {
    const k = ease(clamp01(t / cuts[0]));
    const radar: RadarState = { t, clock: clock(t), progress: lerp(0.86, 0.9, k), target: "live", trail: 0 };
    const talk = t > atcTalk[0] && t < atcTalk[1] ? 1 : 0;
    return (
      <>
        <Cam pos={lerp3([0.55, 1.62, 2.15], [0.35, 1.5, 1.55], k)} look={[-0.1, 1.2, -0.3]} fov={46} />
        <color attach="background" args={["#020306"]} />
        <AtcRoom t={t} radar={radar} talk={talk} />
      </>
    );
  }
  if (t < cuts[1]) {
    const lt = t - cuts[0], k = ease(clamp01(lt / (cuts[1] - cuts[0])));
    const talk = t > pilotTalk[0] && t < pilotTalk[1] ? 1 : 0;
    const mood = NIGHT.cruise;
    return (
      <>
        <Cam pos={lerp3([-0.08, 1.44, -1.2], [-0.14, 1.41, -1.02], k)} look={[-0.38, 1.04, 1.4]} fov={52} />
        <SkyDome mood={mood} t={t} />
        <Stars t={t} />
        <ambientLight intensity={0.05} color="#33435a" />
        <directionalLight position={[-3, 2, 3]} intensity={0.25} color="#a8bde0" />
        <Cockpit777 t={t} env={env} talk={talk} />
        <group position={[0, -1500, 0]}>
          <CloudLayer mood={mood} t={t} count={40} seed={8} center={[0, 0, 2500]} area={[6000, 80, 4000]} size={[900, 1600]} opacity={0.65} drift={[0, 0, -120]} />
        </group>
        <Glow pos={[-1400, 1300, 2600]} color="#dfe8ff" size={160} intensity={0.9} />
      </>
    );
  }
  // exterior: the 777 cruising alone over a moonlit cloud deck
  const lt = t - cuts[1], k = clamp01(lt / (dur - cuts[1]));
  const mood = NIGHT.cruise;
  return (
    <>
      <Cam pos={lerp3([-62, 9, 58], [-48, 7, 66], k)} look={[2, 1, 0]} fov={34} />
      <SkyDome mood={mood} t={t} />
      <Stars t={t} />
      <ambientLight intensity={0.16} color="#3b4c66" />
      <directionalLight position={[-400, 300, 500]} intensity={0.9} color={mood.sunColor} />
      <hemisphereLight args={["#2c3a52", "#0a0d12", 0.3]} />
      <group rotation={[0, 0, 0.02]}>
        <B777 env={env} gear={0} lights={lightsAt(t + 0.3)} scaleGlow={1.6} />
      </group>
      <CloudLayer mood={mood} t={t} count={45} seed={3} center={[200 - lt * 240, -700, 0]} area={[5000, 60, 3500]} size={[700, 1300]} opacity={0.7} />
      <Glow pos={[-2200, 1500, 2800]} color="#e6edff" size={220} intensity={0.85} />
    </>
  );
};

// ------------------------------------------------------------------ the open ocean: a light in the fog
export const S4: React.FC<{ t: number; dur: number; lightAt: number; fadeAt: number }> = ({ t, dur, lightAt, fadeAt }) => {
  const mood = NIGHT.ocean;
  const k = clamp01(t / dur);
  const appear = clamp01((t - lightAt) / 3.0) * (1 - clamp01((t - fadeAt) / 2.2));
  const L = lightsAt(t);
  // the aircraft drifts slowly across, far out in the fog, a little below the cloud base
  const ax = lerp(-260, 120, clamp01((t - lightAt + 1) / (dur - lightAt + 2)));
  return (
    <>
      <Cam pos={[0, 6 + Math.sin(t * 0.6) * 0.5, 40 - k * 25]} look={[0, 34, -600]} fov={46} roll={Math.sin(t * 0.4) * 0.012} />
      <SkyDome mood={mood} t={t} />
      <MoodFog mood={mood} density={0.0011} />
      <ambientLight intensity={0.1} color="#2a3646" />
      <directionalLight position={[100, 200, -600]} intensity={0.25} color={mood.sunColor} />
      <Ocean mood={mood} t={t} />
      <CloudLayer mood={mood} t={t} count={30} seed={12} center={[0, 26, -350]} area={[900, 30, 700]} size={[160, 340]} opacity={0.55} drift={[1.5, 0, 0]} />
      <CloudLayer mood={mood} t={t} count={16} seed={13} center={[0, 12, -120]} area={[400, 10, 200]} size={[70, 160]} opacity={0.35} drift={[2.5, 0, 0]} />
      {appear > 0.01 ? (
        <group position={[ax, 70, -700]}>
          <Glow pos={[0, 0, 0]} color="#ffffff" size={110} intensity={L.strobe * appear} fog={false} />
          <Glow pos={[0, 0, 0]} color="#cfe0ff" size={300} intensity={L.strobe * appear * 0.4} fog={false} />
          <Glow pos={[-10, -2, 0]} color="#fff3dc" size={70} intensity={appear * 0.55} fog={false} />
          <Glow pos={[8, 3, 0]} color="#ff2a10" size={40} intensity={(0.3 + L.beacon) * appear} fog={false} />
          <Glow pos={[0, 0, 0]} color="#9fb4d0" size={420} intensity={appear * 0.16} fog={false} />
        </group>
      ) : null}
    </>
  );
};
