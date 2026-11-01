import React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { interpolate, Easing, useVideoConfig } from "remotion";
import { SkyDome, Stars } from "./three/Sky";
import { Astronaut } from "./three/Astronaut";
import { Explosion } from "./three/Explosion";
import { Waves } from "./three/Waves";
import { Earth, Sun } from "./three/Earth";
import { useSpaceEnv } from "./three/env";

const ease = Easing.bezier(0.45, 0, 0.25, 1);
const lerp3 = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k) as [number, number, number];

/** Sets the camera every frame (deterministic: no animation loop). */
const Cam: React.FC<{ pos: [number, number, number]; look: [number, number, number]; fov?: number; roll?: number }> = ({ pos, look, fov = 35, roll = 0 }) => {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  cam.position.set(...pos);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(...look);
  if (cam.fov !== fov) {
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }
  return null;
};

export const Canvas3D: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      linear
      flat
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ fov: 35, near: 0.05, far: 3000, position: [0, 0, 10] }}
      style={{ background: "#000" }}
    >
      {children}
    </ThreeCanvas>
  );
};

const BOOM = new THREE.Vector3(30, 14, -80);
const SUN = new THREE.Vector3(-1, 0.35, 0.5);

/** 1–2: astronaut adrift, a huge explosion far away — and total silence. */
export const HookScene: React.FC<{ t: number; boomT: number; orbit?: boolean }> = ({ t, boomT, orbit = false }) => {
  const boomStrength = boomT < 0 ? 0 : Math.round(Math.max(0.25, Math.exp(-boomT * 0.8) * 1.6) * 10) / 10;
  const env = useSpaceEnv(SUN, 1, BOOM.clone().normalize(), boomStrength);
  const { height } = useVideoConfig();
  let pos: [number, number, number], look: [number, number, number], fov: number;
  if (!orbit) {
    const k = ease(Math.min(1, t / 7.2));
    pos = lerp3([-2.2, 0.2, 7.2], [-1.5, 0.35, 5.6], k);
    look = lerp3([1.2, 2.2, -6], [1.4, 2.0, -6], k);
    fov = 42 - k * 4;
  } else {
    // orbit on the side opposite the explosion so the fireball stays behind the astronaut
    const a = -0.95 + ease(Math.min(1, t / 6.5)) * 0.85;
    pos = [Math.sin(a) * 4.6, 0.9 - t * 0.04, Math.cos(a) * 4.6];
    look = [1.0, 1.0, -2.6];
    fov = 38;
  }
  const flash = boomT < 0 ? 0 : Math.exp(-boomT * 1.8);
  return (
    <>
      <Cam pos={pos} look={look} fov={fov} roll={0.06} />
      <SkyDome intensity={1} band={1} />
      <Stars count={5000} time={t} />
      <ambientLight intensity={0.08} color="#5c7cff" />
      <directionalLight position={[SUN.x * 20, SUN.y * 20, SUN.z * 20]} intensity={2.3} color="#fff1dc" />
      <directionalLight position={[3, 2, -6]} intensity={0.9} color="#6f8dff" />
      <directionalLight position={[BOOM.x, BOOM.y, BOOM.z]} intensity={flash * 4 + (boomT > 0 ? 0.6 : 0)} color="#ffae5c" />
      <group position={[0, 0.2 + Math.sin(t * 0.6) * 0.05, 0]} rotation={[0.15 + Math.sin(t * 0.3) * 0.05, -0.55 + t * 0.035, 0.12 + Math.sin(t * 0.4) * 0.04]}>
        <Astronaut env={env} visorGlow={flash * 0.6} pose={{ armR: 0.5 + Math.sin(t * 0.5) * 0.08, armL: 0.25, elbowR: 0.6, elbowL: 0.9, legR: 0.3, legL: -0.15, kneeR: 0.6, kneeL: 0.3 }} />
      </group>
      <group position={BOOM.toArray()}>
        <Explosion t={boomT} scale={5} />
      </group>
      <group visible={height > 0} />
    </>
  );
};

/** 3: close on the gold visor, reflecting the fireball. */
export const VisorScene: React.FC<{ t: number; boomT: number }> = ({ t, boomT }) => {
  const env = useSpaceEnv(SUN, 1, new THREE.Vector3(-0.3, 0.2, 1), Math.round(Math.max(0.5, 1.6 * Math.exp(-boomT * 0.15)) * 10) / 10);
  const k = ease(Math.min(1, t / 2.8));
  return (
    <>
      <Cam pos={lerp3([1.2, 1.25, 3.6], [0.85, 1.12, 2.9], k)} look={[0.05, 0.85, 0.1]} fov={30} roll={-0.05} />
      <SkyDome intensity={0.8} />
      <Stars count={4000} time={t} />
      <ambientLight intensity={0.06} color="#5c7cff" />
      <directionalLight position={[-20, 7, 10]} intensity={2.2} color="#f4f6ff" />
      <directionalLight position={[6, 3, -6]} intensity={1.2} color="#6f8dff" />
      <directionalLight position={[-3, 2, 8]} intensity={0.55 + Math.sin(t * 9) * 0.06} color="#ffa553" />
      <group position={[0, 0.15, 0]} rotation={[0.05, 0.25 + t * 0.03, 0]}>
        <Astronaut env={env} visorGlow={0.18 + 0.05 * Math.sin(t * 7)} pose={{ armR: 0.4, armL: 0.3 }} />
      </group>
    </>
  );
};

/** 4–5: the science — sound needs molecules to travel; in vacuum there are none. */
export const WaveScene: React.FC<{ t: number; mode: "air" | "vacuum" }> = ({ t, mode }) => {
  const env = useSpaceEnv(new THREE.Vector3(0.6, 0.8, 0.5), 1);
  const k = ease(Math.min(1, t / 5.8));
  const pos = mode === "air" ? lerp3([5.5, -9.5, 15], [2.5, -4.5, 19], k) : lerp3([-5, -5.5, 15], [-2.2, -6.5, 10.5], k);
  const look: [number, number, number] = mode === "air" ? [0, -3.2, 0] : lerp3([0, -4.5, 0], [0, -7.2, 0], k);
  return (
    <>
      <Cam pos={pos} look={look} fov={40} />
      <SkyDome intensity={mode === "air" ? 0.35 : 0.9} band={mode === "air" ? 0.3 : 1} />
      {mode === "vacuum" ? <Stars count={4000} time={t} /> : null}
      {mode === "air" ? <fog attach="fog" args={["#06112a", 18, 46]} /> : null}
      <ambientLight intensity={0.25} color="#7b96ff" />
      <directionalLight position={[8, 10, 12]} intensity={2.2} color="#fff0d8" />
      <directionalLight position={[-10, -4, -8]} intensity={0.8} color="#4f6cff" />
      <pointLight position={[0, -8.6, 2]} intensity={6} distance={14} color="#ffbf5e" />
      <Waves t={t} mode={mode} env={env} />
    </>
  );
};

/** 6: another explosion — its energy can't reach the astronaut as sound. */
export const NoReachScene: React.FC<{ t: number }> = ({ t }) => {
  const boomT = t - 0.3;
  const env = useSpaceEnv(SUN, 1, new THREE.Vector3(0.3, 0.1, -1), boomT < 0 ? 0 : Math.round(Math.max(0.3, 1.5 * Math.exp(-boomT * 0.7)) * 10) / 10);
  const k = ease(Math.min(1, t / 4.4));
  const flash = boomT < 0 ? 0 : Math.exp(-boomT * 1.8);
  return (
    <>
      <Cam pos={lerp3([-0.9, 1.25, 3.3], [-1.0, 1.2, 3.6], k)} look={lerp3([0.6, 1.6, -20], [0.4, 1.5, -20], k)} fov={40} />
      <SkyDome />
      <Stars count={5000} time={t} />
      <ambientLight intensity={0.07} color="#5c7cff" />
      <directionalLight position={[-20, 7, 10]} intensity={2.1} color="#fff1dc" />
      <directionalLight position={[-4, 4, -40]} intensity={flash * 5 + 0.4} color="#ffae5c" />
      <group position={[0.0, 0.5, -0.9]} rotation={[0.1, 3.25 + t * 0.03, 0.05]}>
        <Astronaut env={env} visorGlow={flash * 0.5} pose={{ armR: 0.25, armL: 0.6, elbowL: 0.4 }} />
      </group>
      <group position={[-4, 4, -40]}>
        <Explosion t={boomT} scale={3.2} seed={11} />
        <DyingWave t={boomT} />
      </group>
    </>
  );
};

/** A golden spherical "sound" wavefront that fades to nothing — no medium to carry it. */
const DyingWave: React.FC<{ t: number }> = ({ t }) => {
  const mat = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uA: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `varying vec3 vN; varying vec3 vV; uniform float uA; void main(){ float f = pow(1.0-abs(dot(vN,vV)), 3.0); gl_FragColor = vec4(vec3(1.0,0.78,0.38)*f*uA, f*uA); }`,
      }),
    [],
  );
  if (t < 0) return null;
  const waves = [0, 0.55, 1.1];
  return (
    <>
      {waves.map((d, i) => {
        const tt = t - d;
        if (tt < 0) return null;
        const r = 2 + tt * 9;
        const a = Math.max(0, 1 - tt / 1.6) ** 2 * 0.9;
        const m = mat.clone();
        m.uniforms.uA.value = a;
        return (
          <mesh key={i} material={m} scale={r}>
            <sphereGeometry args={[1, 48, 32]} />
          </mesh>
        );
      })}
    </>
  );
};

/** 7: Earth and the Milky Way. */
export const EarthScene: React.FC<{ t: number; len: number }> = ({ t, len }) => {
  const k = ease(Math.min(1, t / len));
  const pos = lerp3([-3, 7.5, 19], [0, 9, 44], k);
  const look = lerp3([0.5, 3.5, 0], [0, 1.5, 0], k);
  const sunDir = new THREE.Vector3(-0.75, 0.35, 0.55);
  return (
    <>
      <Cam pos={pos} look={look} fov={42} roll={0.05 - k * 0.05} />
      <SkyDome intensity={1.1} band={1.25} />
      <Stars count={6000} time={t} />
      <group position={[0, -2, 0]}>
        <Earth rot={2.4 + t * 0.02} sunDir={sunDir} />
      </group>
      <Sun position={[-300, 140, -160]} size={150} intensity={interpolate(t, [0, 3, len], [0.4, 1, 1.15], { extrapolateRight: "clamp" })} />
    </>
  );
};
