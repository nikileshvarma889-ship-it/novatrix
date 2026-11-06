import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { Easing, useVideoConfig } from "remotion";
import { Ship } from "./three/Ship";
import { AtcRoom } from "./three/AtcRoom";
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

// ------------------------------------------------------------------ S1: the search at sea (fact)
export const S1: React.FC<{ t: number; dur: number; cut: number }> = ({ t, dur, cut }) => {
  const mood = NIGHT.ocean;
  const env = useMoodEnv(mood);
  const yaw = Math.sin(t * 0.45) * 0.55 + 0.2;
  const shipX = -40 + t * 4.5;
  let cam: React.ReactNode;
  if (t < cut) {
    const k = ease(clamp01(t / cut));
    cam = <Cam pos={[shipX + 200 - k * 30, 6 + Math.sin(t * 0.7) * 0.6, 240 - k * 25]} look={[shipX + 10, 12, 0]} fov={32} roll={Math.sin(t * 0.5) * 0.015} />;
  } else {
    const k = ease(clamp01((t - cut) / (dur - cut)));
    cam = <Cam pos={[shipX - 110 + k * 30, 210 - k * 30, 170]} look={[shipX + 35, 0, -10]} fov={lerp(42, 36, k)} />;
  }
  return (
    <>
      {cam}
      <SkyDome mood={mood} t={t} />
      <MoodFog mood={mood} density={0.0009} />
      <ambientLight intensity={0.16} color="#3a4658" />
      <directionalLight position={[100, 200, -600]} intensity={0.35} color={mood.sunColor} />
      <hemisphereLight args={["#34445a", "#06080a", 0.3]} />
      <Ocean mood={mood} t={t} />
      <group position={[shipX, Math.sin(t * 0.8) * 0.5, 0]} rotation={[Math.sin(t * 0.6) * 0.02, 0.08, Math.sin(t * 0.7) * 0.025]}>
        <Ship t={t} env={env} beamYaw={yaw} />
      </group>
      <pointLight position={[shipX + 80 * Math.cos(yaw), 2, -80 * Math.sin(yaw)]} intensity={1600} distance={90} decay={1.5} color="#dfe9ff" />
      <CloudLayer mood={mood} t={t} count={24} seed={22} center={[0, 60, -500]} area={[1800, 40, 900]} size={[260, 520]} opacity={0.45} drift={[2, 0, 0]} />
    </>
  );
};

// ------------------------------------------------------------------ S3: the midnight transmission (fiction)
export const S3: React.FC<{ t: number; dur: number; radar: OceanState; shots: [number, number][]; ghost: [number, number][]; ctrl: [number, number]; freezeAt: number }> = ({ t, dur, radar, shots, ghost, ctrl, freezeAt }) => {
  const rx = ghost.some(([a, b]) => t > a - 0.2 && t < b + 0.3) ? 1 : 0;
  const flicker = ghost.some(([a, b]) => t > a && t < b + 0.6) ? 0.6 : 0;
  const freeze = clamp01((t - freezeAt) / 0.6);
  const talk = t > ctrl[0] && t < ctrl[1] ? 1 : 0;
  const close = shots.some(([a, b]) => t >= a && t < b);
  const k = clamp01(t / dur);
  const shake = rx ? (Math.sin(t * 41) * 0.004) : 0;
  return (
    <>
      {close ? (
        <Cam pos={[-0.4 + shake, 1.2, 0.55]} look={[-0.56, 0.86, -0.1]} fov={64 - 6 * k} />
      ) : (
        <Cam pos={lerp3([1.2, 1.75, 3.0], [0.5, 1.55, 1.75], ease(k))} look={[-0.05, 1.15, -0.3]} fov={44} roll={shake} />
      )}
      <color attach="background" args={["#010204"]} />
      <AtcRoom t={t} radar={radar} talk={talk} rx={rx} flicker={flicker} freeze={freeze} />
    </>
  );
};
