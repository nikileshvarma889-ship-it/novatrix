import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { useVideoConfig } from "remotion";
import { Cam, useStudioEnv, Table, Arrow, CurvedArrow, NightSky } from "./three/Props";
import { Firecracker, fusePoint, fuseSparks, gasInside, Explosion, burst } from "./three/Firecracker";
import { Rocket, rocketExhaust, Spinner, spinnerSparks, shells, Skyline, Burst } from "./three/Fireworks";
import { Glow, LightField } from "./three/Lights";
import { PBuf, Sprites } from "./three/Particles";
import { FC, FC_BASE, V3, clamp01, smooth, hash, camS1, camS2, camS3, camS4a, camS4b, camS5, rocketY, ROCKET_X, HUB, WHEEL_R, spinRev } from "./sim";

/** Explosion physics runs at this fraction of real time (slow-motion visualisation). */
export const SLOW = 0.36;

export const Canvas3D: React.FC<{ children: React.ReactNode; exposure?: number }> = ({ children, exposure = 1.0 }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposure }} camera={{ fov: 40, near: 0.05, far: 20000, position: [0, 2, 10] }} style={{ background: "#000" }}>
      {children}
    </ThreeCanvas>
  );
};

const Stars: React.FC<{ t: number; count?: number; r?: number; intensity?: number }> = ({ t, count = 1100, r = 8000, intensity = 1 }) => {
  const pts = useMemo(() => Array.from({ length: count }, (_, i) => {
    const a = hash(i, 81) * Math.PI * 2, el = Math.asin(0.06 + hash(i, 82) * 0.94);
    return [Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(a) * Math.cos(el) * r] as V3;
  }), [count, r]);
  return <LightField points={pts} color="#dfe8ff" size={r / 2600} minPx={2} intensity={0.7 * intensity} twinkle={0.5} t={t} />;
};

/** Out-of-focus sparks drifting far behind the subject (intro / studio backdrop). */
const Bokeh: React.FC<{ t: number; n?: number; spread?: number; z?: number; intensity?: number }> = ({ t, n = 46, spread = 1, z = -45, intensity = 1 }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const x = (hash(i, 91) - 0.5) * 60 * spread, y0 = 5 + hash(i, 92) * 30 * spread, zz = z - hash(i, 93) * 40 * spread;
      const y = y0 + ((t * (0.6 + hash(i, 94))) % 40) * 0.5;
      const f = 0.55 + 0.45 * Math.sin(t * (1.5 + hash(i, 95) * 3) + i);
      return <Glow key={i} pos={[x, y, zz]} color={hash(i, 96) > 0.3 ? "#ff9a3c" : "#ffd27a"} size={(2.5 + hash(i, 97) * 5) * spread} intensity={(0.12 + 0.3 * hash(i, 98)) * f * intensity} />;
    })}
  </>
);

const StudioLights: React.FC<{ key2?: number; rim?: number }> = ({ key2 = 1, rim = 1 }) => (
  <>
    <ambientLight intensity={0.05} color="#8090a8" />
    <directionalLight position={[-6, 9, 7]} intensity={2.3 * key2} color="#ffd2a8" />
    <directionalLight position={[6, 4, -9]} intensity={2.4 * rim} color="#8fb0ff" />
    <directionalLight position={[8, 2, 6]} intensity={0.25} color="#ffffff" />
  </>
);

// ------------------------------------------------------------------ 1. intro: the firecracker on a dark surface
export const S1: React.FC<{ t: number; d: number }> = ({ t, d }) => {
  const env = useStudioEnv();
  return (
    <>
      <Cam c={camS1(t, d)} />
      <color attach="background" args={["#020203"]} />
      <StudioLights />
      <Table env={env} shadow={[-0.6, 0.15, 9, 2.91]} />
      <pointLight position={[-1, 5, 4]} color="#ffb47a" intensity={14} distance={30} decay={2} />
      <group position={[0, FC.R, 0]} rotation={[0, 2.91, -Math.PI / 2]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <Firecracker t={t} env={env} />
        </group>
      </group>
      <Bokeh t={t} intensity={0.8 + 0.2 * Math.sin(t * 2)} />
    </>
  );
};

// ------------------------------------------------------------------ 2. inside: simplified cutaway, fuse, reaction, pressure
export function s2State(t: number, d: number, fs: number, fe: number) {
  const fuse = clamp01((t - fs) / (fe - fs));
  const burn = clamp01((t - fe) / 2.6);
  const pressure = 0.78 * smooth(fe + 0.2, d, t);
  return { cut: smooth(0.15, 1.3, t), fuse, lit: t > fs && t < fe, burn, heat: clamp01((t - fe) * 3), pressure, bulge: 0.05 * pressure, glowCasing: 0.45 * pressure };
}
export const S2: React.FC<{ t: number; d: number; fs: number; fe: number }> = ({ t, d, fs, fe }) => {
  const env = useStudioEnv();
  const st = s2State(t, d, fs, fe);
  const add = new PBuf(3000);
  if (st.lit) fuseSparks(add, t, fusePoint(1 - st.fuse), FC_BASE);
  if (st.burn > 0) gasInside(add, t, st.burn, st.pressure / 0.78 * 0.7, FC_BASE);
  return (
    <>
      <Cam c={camS2(t, d)} />
      <color attach="background" args={["#020203"]} />
      <StudioLights key2={0.9} />
      <Table env={env} shadow={[0, 0, 3.2, 0]} />
      <group position={FC_BASE}><Firecracker t={t} env={env} {...st} /></group>
      {st.burn > 0 ? <pointLight position={[1.5, 3.2, 2.5]} color="#ff8a3a" intensity={30 * st.heat * (0.6 + st.pressure)} distance={14} decay={2} /> : null}
      <Sprites data={add} />
      <Bokeh t={t + 6} intensity={0.45} />
    </>
  );
};

// ------------------------------------------------------------------ 3. rupture in slow motion
export const S3: React.FC<{ t: number; d: number; rup: number }> = ({ t, d, rup }) => {
  const env = useStudioEnv();
  const pre = clamp01(t / rup);
  const tr = t - rup;
  const shake = tr < 0 ? pre * pre * 0.03 : 0;
  const jit: V3 = [Math.sin(t * 63) * shake, 0, Math.cos(t * 71) * shake];
  const add = new PBuf(9000), smoke = new PBuf(400);
  const pressure = 0.78 + 0.22 * pre;
  if (tr < 0) gasInside(add, t, 1, 0.7 + 0.6 * pre, FC_BASE);
  else burst(add, smoke, tr * SLOW, FC_BASE);
  return (
    <>
      <Cam c={camS3(t, d, rup)} />
      <color attach="background" args={["#020203"]} />
      <StudioLights key2={0.85} />
      <Table env={env} shadow={tr < 0 ? [0, 0, 3.2, 0] : undefined} />
      {tr < 0 ? (
        <group position={[FC_BASE[0] + jit[0], FC_BASE[1], FC_BASE[2] + jit[2]]}>
          <Firecracker t={t} env={env} cut={1} fuse={1} burn={1} heat={1} pressure={pressure} bulge={0.04 + 0.16 * pre ** 2} glowCasing={0.35 + 0.65 * pre} />
          <pointLight position={[1.5, 0.2, 2.5]} color="#ff8a3a" intensity={45 * (0.8 + pre)} distance={14} decay={2} />
        </group>
      ) : null}
      <Explosion tr={tr < 0 ? tr : tr * SLOW} center={FC_BASE} env={env} />
      <Sprites data={smoke} blend="normal" kind="smoke" order={5} />
      <Sprites data={add} />
      <Bokeh t={t + 12} intensity={0.35} />
    </>
  );
};

// ------------------------------------------------------------------ 4a. rocket vs firecracker
export const S4a: React.FC<{ t: number; ig: number; lift: number }> = ({ t, ig, lift }) => {
  const env = useStudioEnv("#ffc89a", "#6f8fd8");
  const y = rocketY(t, lift);
  const add = new PBuf(6000), smoke = new PBuf(1200);
  if (t > ig) rocketExhaust(add, smoke, t, ig, lift);
  const k = clamp01((t - lift - 0.6) / 1.5);
  return (
    <>
      <Cam c={camS4a(t, lift)} />
      <NightSky horizon="#1d2445" />
      <Stars t={t} />
      <ambientLight intensity={0.08} color="#8090b0" />
      <directionalLight position={[-30, 50, 40]} intensity={0.9} color="#b9c8ff" />
      <directionalLight position={[40, 20, -60]} intensity={1.4} color="#7f9cff" />
      <Table env={env} size={6000} color="#0c0d0c" />
      {/* the sealed firecracker stays on the ground */}
      <group position={[-12, FC.L / 2, 0]} rotation={[0, 0.25, 0]}><Firecracker t={t} env={env} /></group>
      {/* launch tube */}
      <mesh position={[ROCKET_X + 1.75, 14, 0]}><cylinderGeometry args={[1.1, 1.1, 28, 20]} /><meshStandardMaterial color="#3a3d42" roughness={0.6} metalness={0.4} envMap={env} /></mesh>
      <group position={[ROCKET_X, y, 0]}>
        <Rocket env={env} burning={t > ig ? 1 : 0} t={t} />
        <Arrow position={[-5, 4, 2]} len={11 + 2 * k} r={0.55} color="#38e07a" opacity={clamp01((t - lift - 0.4) * 2.5)} />
        <Arrow position={[0, -4, 2]} dir={[0, -1, 0]} len={12} r={0.55} color="#ff7a2e" opacity={clamp01((t - lift - 0.4) * 2.5)} />
      </group>
      <Sprites data={smoke} blend="normal" kind="smoke" order={5} />
      <Sprites data={add} />
    </>
  );
};

// ------------------------------------------------------------------ 4b. spinner
export const S4b: React.FC<{ t: number; d: number; ig: number }> = ({ t, d, ig }) => {
  const env = useStudioEnv("#ffc89a", "#6f8fd8");
  const ang = spinRev(t, ig) * Math.PI * 2;
  const add = new PBuf(4200);
  if (t > ig) spinnerSparks(add, t, ig);
  const ao = clamp01((t - ig - 0.8) * 2);
  return (
    <>
      <Cam c={camS4b(t, d)} />
      <NightSky horizon="#1a2142" />
      <Stars t={t} />
      <ambientLight intensity={0.08} color="#8090b0" />
      <directionalLight position={[-30, 60, 60]} intensity={0.8} color="#b9c8ff" />
      <pointLight position={[HUB[0], HUB[1], 12]} color="#ffb060" intensity={t > ig ? 1500 : 0} distance={200} decay={2} />
      <Table env={env} size={6000} color="#0c0d0c" />
      <mesh position={[0, HUB[1] / 2 - 1, -1.6]}><boxGeometry args={[2.2, HUB[1], 2.2]} /><meshStandardMaterial color="#6b5032" roughness={0.85} envMap={env} envMapIntensity={0.3} /></mesh>
      <group position={HUB}><Spinner env={env} angle={ang} burning={t > ig ? 1 : 0} t={t} /></group>
      {[0, 1, 2, 3].map((n) => {
        const th = ang + (n * Math.PI) / 2;
        const p: V3 = [HUB[0] + Math.cos(th) * WHEEL_R + Math.sin(th) * 3.6, HUB[1] + Math.sin(th) * WHEEL_R - Math.cos(th) * 3.6, 2];
        return <Arrow key={n} position={p} dir={[Math.sin(th), -Math.cos(th), 0]} len={7} r={0.42} color="#ff7a2e" opacity={ao} />;
      })}
      <CurvedArrow position={[HUB[0], HUB[1], 3]} radius={16} tube={0.55} arc={1.7} start={0.35} color="#38e07a" opacity={clamp01((t - ig - 1.6) * 2)} />
      <CurvedArrow position={[HUB[0], HUB[1], 3]} radius={16} tube={0.55} arc={1.7} start={0.35 + Math.PI} color="#38e07a" opacity={clamp01((t - ig - 1.6) * 2)} />
      <Sprites data={add} />
      <Bokeh t={t} z={-300} spread={6} n={30} intensity={0.35} />
    </>
  );
};

// ------------------------------------------------------------------ 5. finale
export const S5: React.FC<{ t: number; d: number; bursts: Burst[] }> = ({ t, d, bursts }) => {
  const add = new PBuf(16000);
  const flash = shells(add, t, bursts);
  return (
    <>
      <Cam c={camS5(t, d)} />
      <NightSky horizon="#1b2244" flash={flash} />
      <Stars t={t} />
      <Skyline t={t} />
      <Sprites data={add} kind="spark" minPx={2} />
    </>
  );
};
