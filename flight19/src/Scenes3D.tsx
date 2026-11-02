import React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { Easing, useVideoConfig } from "remotion";
import { Avenger } from "./three/Avenger";
import { Mariner } from "./three/Mariner";
import { Airfield } from "./three/Airfield";
import { Cockpit } from "./three/Cockpit";
import { RadioRoom } from "./three/RadioRoom";
import { RadarScope, Blip } from "./three/Radar";
import { CloudLayer, MOODS, MoodFog, Ocean, SkyDome } from "./three/World";
import { lightning, useMoodEnv } from "./three/env";

const ease = Easing.bezier(0.42, 0, 0.3, 1);
const lerp3 = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k) as [number, number, number];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const Cam: React.FC<{ pos: [number, number, number]; look: [number, number, number]; fov?: number; roll?: number }> = ({ pos, look, fov = 40, roll = 0 }) => {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  cam.position.set(...pos);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(...look);
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  return null;
};

export const Canvas3D: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }} camera={{ fov: 40, near: 0.05, far: 9000, position: [0, 2, 10] }} style={{ background: "#000" }}>
      {children}
    </ThreeCanvas>
  );
};

/** Formation (echelon right) of five Avengers around a lead position; returns the lead's world transform helper. */
const FORMATION: [number, number, number][] = [[0, 0, 0], [-14, -2, -14], [-28, -4, -28], [-14, -1.5, 14], [-28, -3, 28]];
const CODES = ["FT-28", "FT-36", "FT-3", "FT-117", "FT-81"];
const Formation: React.FC<{ lead: [number, number, number]; t: number; env: THREE.Texture; heading?: number; bank?: number; spread?: number; lights?: number }> = ({ lead, t, env, heading = 0, bank = 0, spread = 1, lights = 0 }) => (
  <group position={lead} rotation={[bank, heading, 0]}>
    {FORMATION.map((o, i) => (
      <group key={i} position={[o[0] * spread + Math.sin(t * 0.7 + i) * 0.4, o[1] * spread + Math.sin(t * 0.9 + i * 2) * 0.35, o[2] * spread]} rotation={[Math.sin(t * 0.5 + i) * 0.03, 0, Math.sin(t * 0.6 + i) * 0.02]}>
        <Avenger code={CODES[i]} prop={1000} gear={0} env={env} lights={lights} />
      </group>
    ))}
  </group>
);

// ------------------------------------------------------------------ S1 — takeoff
export const S1: React.FC<{ t: number; dur: number }> = ({ t, dur }) => {
  const mood = MOODS.day;
  const env = useMoodEnv(mood);
  const cut = dur * 0.52;
  if (t < cut) {
    // ground level beside the runway: five Avengers roll and lift off one after another
    const planes = [0, 1, 2, 3, 4].map((i) => {
      const tau = Math.max(0, t + 1.6 - i * 1.15);
      const v = Math.min(44, 7.5 * tau);
      const s = tau < 44 / 7.5 ? 0.5 * 7.5 * tau * tau : 0.5 * 44 * (44 / 7.5) + 44 * (tau - 44 / 7.5);
      const lift = Math.max(0, tau - 5.2);
      const x = -150 - i * 38 + s, y = 1.62 + lift * lift * 1.6, pitch = Math.min(0.16, lift * 0.12);
      return { x, y, pitch, gear: clamp01(1 - (lift - 1.2) / 1.5), z: i % 2 ? 6 : -6, v };
    });
    const k = ease(clamp01(t / cut));
    const lead = planes[0];
    return (
      <>
        <Cam pos={[-30, 2.1, 26]} look={[lead.x + 6, lead.y * 0.85 + 1.4, 0]} fov={38} />
        <SkyDome mood={mood} t={t} />
        <MoodFog mood={mood} density={0.0016} />
        <ambientLight intensity={0.35} color="#9fb0c6" />
        <directionalLight position={[-200, 300, 200]} intensity={mood.sunI} color={mood.sunColor} />
        <hemisphereLight args={["#aab8c8", "#3a3f2e", 0.5]} />
        <Airfield env={env} />
        {planes.map((p, i) => (
          <group key={i} position={[p.x, p.y, p.z]} rotation={[0, 0, p.pitch]}>
            <Avenger code={CODES[i]} prop={1000} gear={p.gear} env={env} />
          </group>
        ))}
      </>
    );
  }
  // climbing out over the coastline in formation
  const u = t - cut, k = ease(clamp01(u / (dur - cut)));
  const lead: [number, number, number] = [u * 70, 220 + u * 9, 0];
  return (
    <>
      <Cam pos={lerp3([lead[0] - 60, lead[1] + 14, 34], [lead[0] - 40, lead[1] + 9, 52], k)} look={[lead[0] - 8, lead[1] - 3, 0]} fov={42} roll={-0.04} />
      <SkyDome mood={mood} t={t} />
      <MoodFog mood={mood} density={0.0007} />
      <ambientLight intensity={0.35} color="#9fb0c6" />
      <directionalLight position={[-200, 300, 200]} intensity={mood.sunI} color={mood.sunColor} />
      <group position={[-400, 0, 0]}><Airfield env={env} /></group>
      <Ocean mood={mood} t={t} y={-0.5} />
      <CloudLayer mood={mood} t={t} count={18} center={[lead[0] + 400, 330, 0]} area={[1800, 60, 1400]} size={[200, 420]} opacity={0.55} seed={2} />
      <Formation lead={lead} t={t} env={env} bank={0.0} />
    </>
  );
};

// ------------------------------------------------------------------ S2 — lost over the Atlantic
export const S2: React.FC<{ t: number; dur: number }> = ({ t, dur }) => {
  const mood = MOODS.dusk;
  const env = useMoodEnv(mood);
  const lead: [number, number, number] = [t * 75, 420, 0];
  const cut = dur * 0.5;
  const k = ease(clamp01(t < cut ? t / cut : (t - cut) / (dur - cut)));
  const shotA = t < cut;
  return (
    <>
      {shotA ? (
        <Cam pos={lerp3([lead[0] + 6, lead[1] + 3, 26], [lead[0] - 10, lead[1] + 5, 30], k)} look={[lead[0] - 4, lead[1], 0]} fov={36} roll={0.05} />
      ) : (
        <Cam pos={lerp3([lead[0] - 160, lead[1] + 260, 120], [lead[0] - 120, lead[1] + 330, 160], k)} look={[lead[0], lead[1] - 40, 0]} fov={44} />
      )}
      <SkyDome mood={mood} t={t} />
      <MoodFog mood={mood} density={0.0012} />
      <ambientLight intensity={0.28} color="#8293a8" />
      <directionalLight position={[mood.sun.x * 500, mood.sun.y * 500, mood.sun.z * 500]} intensity={mood.sunI} color={mood.sunColor} />
      <Ocean mood={mood} t={t} />
      <CloudLayer mood={mood} t={t} count={36} center={[lead[0] + 200, 400, 0]} area={[1600, 220, 1600]} size={[180, 480]} opacity={0.6} seed={5} />
      <Formation lead={lead} t={t} env={env} />
    </>
  );
};

// ------------------------------------------------------------------ S3 — radio (cockpit, then FT-74)
export const S3: React.FC<{ t: number; dur: number; cut: number }> = ({ t, dur, cut }) => {
  const mood = MOODS.dusk;
  const env = useMoodEnv(mood);
  if (t < cut) {
    // the compass "fails": slow swings with sudden jumps
    const compass = 1.2 + Math.sin(t * 0.9) * 0.8 + Math.sin(t * 3.7) * 0.35 + (Math.floor(t * 0.8) % 2 ? 1.6 : 0);
    const k = ease(clamp01(t / cut));
    return (
      <>
        <Cam pos={lerp3([-1.0, 1.42, -0.32], [-0.85, 1.36, -0.26], k)} look={[0.8, 0.88, 0.02]} fov={50} roll={0.04 + Math.sin(t * 0.7) * 0.01} />
        <SkyDome mood={mood} t={t} />
        <ambientLight intensity={0.25} color="#8193a8" />
        <directionalLight position={[mood.sun.x * 10, mood.sun.y * 10, mood.sun.z * 10]} intensity={1.4} color={mood.sunColor} />
        <pointLight position={[0.35, 1.05, 0]} intensity={0.9} distance={1.6} color="#d8e6ff" />
        <group position={[0, -600, 0]}>
          <Ocean mood={mood} t={t} />
        </group>
        <CloudLayer mood={mood} t={t} count={22} center={[300, 0, 0]} area={[900, 200, 900]} size={[120, 300]} opacity={0.55} seed={8} drift={[-60, 0, 0]} />
        <Cockpit t={t} compass={compass} fuel={1.4} env={env} shake={1} />
      </>
    );
  }
  const u = t - cut, k = ease(clamp01(u / (dur - cut)));
  const p: [number, number, number] = [u * 75, 500, 0];
  return (
    <>
      <Cam pos={lerp3([p[0] + 14, p[1] + 2, 16], [p[0] - 2, p[1] + 4, 20], k)} look={[p[0] - 2, p[1], 0]} fov={34} roll={-0.06} />
      <SkyDome mood={mood} t={t} />
      <MoodFog mood={mood} density={0.0013} />
      <ambientLight intensity={0.28} color="#8293a8" />
      <directionalLight position={[mood.sun.x * 500, mood.sun.y * 500, mood.sun.z * 500]} intensity={mood.sunI} color={mood.sunColor} />
      <Ocean mood={mood} t={t} />
      <CloudLayer mood={mood} t={t} count={30} center={[p[0] + 100, 500, 0]} area={[1200, 160, 1200]} size={[150, 400]} opacity={0.65} seed={9} />
      <group position={p} rotation={[0.08, 0, 0.02]}><Avenger code="FT-74" prop={1000} env={env} /></group>
    </>
  );
};

// ------------------------------------------------------------------ S4 — radar room (dramatization)
const flightBlips = (t: number, n: number, ghost = false): Blip[] => {
  const base: Blip[] = [0, 1, 2, 3, 4].map((i) => ({ x: 0.28 + t * 0.012 + (i % 3) * 0.03, y: 0.42 + t * 0.01 + Math.floor(i / 3) * 0.035 + i * 0.01, on: 1 }));
  if (ghost) base.push({ x: 0.28 + t * 0.012 + 0.09, y: 0.42 + t * 0.01 + 0.02, on: n });
  return base;
};
export const S4: React.FC<{ t: number; dur: number; lightningAt: number[] }> = ({ t, dur, lightningAt }) => {
  const flash = lightning(t, lightningAt);
  const cut = dur * 0.55;
  const k = ease(clamp01(t < cut ? t / cut : (t - cut) / (dur - cut)));
  const fade = clamp01(1 - (t - (dur - 2.2)) / 2);         // blips fade toward the end: contact is slipping
  const blips = flightBlips(t, 0).map((b) => ({ ...b, on: b.on * (0.35 + 0.65 * fade) }));
  return (
    <>
      {t < cut ? (
        <Cam pos={lerp3([0.9, 1.55, 1.9], [0.45, 1.42, 1.2], k)} look={[0, 1.2, -1.4]} fov={46} roll={0.02} />
      ) : (
        <Cam pos={lerp3([0.05, 1.21, -0.25], [0.02, 1.19, -0.5], k)} look={[0, 1.18, -1.4]} fov={40} />
      )}
      <ambientLight intensity={0.05 + flash * 0.6} color="#8090b0" />
      <directionalLight position={[-3, 2, 0]} intensity={0.15 + flash * 2.5} color="#a8b8d8" />
      <pointLight position={[0, 1.2, -1.0]} intensity={0.35} distance={2} color="#5dff9a" />
      <RadioRoom t={t} flash={flash} blips={blips} scopeNoise={0.3 + (1 - fade) * 0.6} />
    </>
  );
};

// ------------------------------------------------------------------ S5 — the sixth aircraft (FICTION)
export const S5: React.FC<{ t: number; dur: number; scopeAt: number; ghostAt: number; lightningAt: number[] }> = ({ t, dur, scopeAt, ghostAt, lightningAt }) => {
  const mood = MOODS.storm;
  const env = useMoodEnv(mood);
  const flash = lightning(t, lightningAt);
  if (t >= scopeAt) {
    const u = t - scopeAt;
    const blips = flightBlips(6 + u, clamp01(u / 1.4), true);
    return (
      <>
        <Cam pos={lerp3([0.03, 1.21, -0.45], [0.02, 1.2, -0.62], ease(clamp01(u / (dur - scopeAt))))} look={[0, 1.18, -1.4]} fov={38} />
        <ambientLight intensity={0.04 + flash * 0.5} />
        <pointLight position={[0, 1.2, -1.0]} intensity={0.35} distance={2} color="#5dff9a" />
        <RadioRoom t={t} flash={flash} blips={blips} scopeNoise={0.6} />
      </>
    );
  }
  const lead: [number, number, number] = [t * 72, 300, 0];
  const k = ease(clamp01(t / scopeAt));
  // the unmarked aircraft drifts in out of the fog on the formation's open side
  const ghostIn = ease(clamp01((t - ghostAt) / 4.0));
  const ghostPos: [number, number, number] = [lead[0] - 12 - (1 - ghostIn) * 60, lead[1] + 2 + Math.sin(t * 0.8) * 0.4, -42 + (1 - ghostIn) * -40];
  return (
    <>
      <Cam pos={lerp3([lead[0] - 52, lead[1] + 7, -78], [lead[0] - 36, lead[1] + 5, -66], k)} look={lerp3([lead[0] - 18, lead[1], -12], [lead[0] - 12, lead[1], -30], k)} fov={40} roll={0.05} />
      <SkyDome mood={mood} t={t} flash={flash} />
      <MoodFog mood={mood} density={0.0042 - ghostIn * 0.0012} />
      <ambientLight intensity={0.16 + flash * 0.8} color="#6c7c92" />
      <directionalLight position={[mood.sun.x * 500, mood.sun.y * 500, mood.sun.z * 500]} intensity={mood.sunI + flash * 2.5} color={flash > 0.1 ? "#cfd9ff" : mood.sunColor} />
      <Ocean mood={mood} t={t} flash={flash} />
      <CloudLayer mood={mood} t={t} count={40} center={[lead[0] + 60, 300, -20]} area={[700, 120, 500]} size={[90, 260]} opacity={0.7} seed={12} flash={flash} />
      <Formation lead={lead} t={t} env={env} spread={0.85} lights={0.6} />
      <group position={ghostPos} rotation={[0.02, 0, Math.sin(t * 0.5) * 0.02]}>
        <Avenger ghost prop={1000} env={env} lights={0} />
      </group>
    </>
  );
};

// ------------------------------------------------------------------ S6 — the rescue aircraft
export const S6: React.FC<{ t: number; dur: number; cuts: [number, number]; lightningAt: number[] }> = ({ t, dur, cuts, lightningAt }) => {
  const mood = MOODS.night;
  const env = useMoodEnv(mood);
  const [c1, c2] = cuts;
  if (t < c1) {
    const p: [number, number, number] = [t * 65, 260, 0];
    const k = ease(clamp01(t / c1));
    const flash = lightning(t, lightningAt);
    return (
      <>
        <Cam pos={lerp3([p[0] - 55, p[1] + 9, 34], [p[0] - 38, p[1] + 6, 44], k)} look={[p[0] + 4, p[1], 0]} fov={40} roll={-0.05} />
        <SkyDome mood={mood} t={t} flash={flash} />
        <MoodFog mood={mood} density={0.0024} />
        <ambientLight intensity={0.1 + flash * 0.7} color="#5c6c88" />
        <directionalLight position={[100, 300, -200]} intensity={0.35 + flash * 2.5} color="#9fb4d8" />
        <Ocean mood={mood} t={t} flash={flash} />
        <CloudLayer mood={mood} t={t} count={26} center={[p[0] + 100, 300, 0]} area={[800, 140, 700]} size={[120, 320]} opacity={0.6} seed={21} flash={flash} />
        <group position={p} rotation={[0.05, 0, 0.03]}><Mariner prop={t * 40} lights={1} env={env} /></group>
      </>
    );
  }
  if (t < c2) {
    // from the deck of the tanker: a flash on the horizon, then fire on the water
    const u = t - c1;
    const boom = u > 1.0 ? Math.exp(-(u - 1.0) * 1.2) : 0;
    const fire = u > 1.0 ? 0.6 + 0.2 * Math.sin(u * 13) * Math.sin(u * 7) : 0;
    return (
      <>
        <Cam pos={[0, 14, 0]} look={[600, 9, 40]} fov={32} />
        <SkyDome mood={mood} t={t} flash={boom * 0.5} />
        <MoodFog mood={mood} density={0.0011} />
        <ambientLight intensity={0.06} />
        <Ocean mood={mood} t={t} glow={new THREE.Vector3(900, 0, 60)} glowI={fire + boom * 2} />
        <mesh position={[900, 6, 60]}><sphereGeometry args={[6 + boom * 30, 16, 12]} /><meshBasicMaterial color="#ff9a3c" transparent opacity={clamp01(fire * 0.6 + boom)} /></mesh>
        <pointLight position={[900, 20, 60]} intensity={(fire + boom * 5) * 400} distance={2000} color="#ff8a2a" />
      </>
    );
  }
  // USS Solomons radar: the contact disappears
  const u = t - c2;
  const on = u < 2.2 ? 1 : clamp01(1 - (u - 2.2) / 0.25);
  return (
    <>
      <Cam pos={lerp3([0.02, 1.2, -0.5], [0.01, 1.19, -0.66], ease(clamp01(u / (dur - c2))))} look={[0, 1.18, -1.4]} fov={38} />
      <ambientLight intensity={0.03} />
      <pointLight position={[0, 1.2, -1.0]} intensity={0.35} distance={2} color="#5dff9a" />
      <RadioRoom t={t} blips={[{ x: -0.22, y: 0.3, on }]} scopeNoise={0.45} lampOn={false} radioGlow={0.6} />
    </>
  );
};

// ------------------------------------------------------------------ S7 — the dead frequency (FICTION)
export const S7: React.FC<{ t: number; dur: number; wake: number }> = ({ t, dur, wake }) => {
  const k = ease(clamp01(t / dur));
  const on = clamp01((t - wake) / 1.2);
  const flick = on * (0.55 + 0.45 * Math.abs(Math.sin(t * 17) * Math.sin(t * 5.3)));
  const blips: Blip[] = on > 0 ? [0, 1, 2, 3, 4].map((i) => ({ x: 0.3 + (i % 3) * 0.03, y: 0.45 + Math.floor(i / 3) * 0.035 + i * 0.01, on: flick })) : [];
  return (
    <>
      <Cam pos={lerp3([1.5, 1.7, 2.2], [0.5, 1.35, 0.6], k)} look={lerp3([-0.2, 1.1, -1.4], [-0.3, 1.1, -1.4], k)} fov={44} roll={-0.03} />
      <ambientLight intensity={0.04} color="#6b7a98" />
      <directionalLight position={[-6, 3, 0.5]} intensity={0.9} color="#8ea6d6" />
      <spotLight position={[-2.2, 2.2, -0.2]} target-position={[0.5, 0, -0.5]} angle={0.5} penumbra={0.7} intensity={6} distance={7} color="#9fb6e6" />
      <pointLight position={[-1.05, 1.1, -0.9]} intensity={on * 0.8 * flick} distance={1.8} color="#ffb04a" />
      <pointLight position={[0, 1.2, -1.0]} intensity={on * 0.3} distance={2} color="#5dff9a" />
      <RadioRoom t={t} abandoned blips={blips} scopePower={on} scopeNoise={0.9} radioGlow={on * 0.9} lampOn={false} />
    </>
  );
};
