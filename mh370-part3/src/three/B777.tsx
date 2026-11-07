import React, { useMemo } from "react";
import * as THREE from "three";
import { Glow } from "./Lights";

/**
 * Boeing 777-200ER at real scale (metres): nose toward +X, up +Y, right wing +Z.
 * Fuselage centreline at y = 0; on its gear the fuselage centre sits 5.7 m above the ground.
 * Generic plain white livery (no airline branding).
 */
const LEN_PROFILE: [number, number][] = [
  [31.7, 0], [31.45, 0.75], [31.0, 1.35], [30.3, 1.95], [29.2, 2.5], [27.6, 2.9], [25.5, 3.08], [23, 3.1],
  [-14, 3.1], [-17, 2.95], [-20, 2.6], [-23, 2.1], [-26, 1.55], [-28.6, 1.0], [-30.6, 0.55], [-31.9, 0.2], [-32, 0],
];

function lathe(profile: [number, number][], seg = 40) {
  // LatheGeometry revolves around Y; profile given as (axial position, radius)
  const pts = profile.map(([x, r]) => new THREE.Vector2(r, x));
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateZ(-Math.PI / 2); // Y axis -> X axis
  g.computeVertexNormals();
  return g;
}

/** Cockpit window band: a slice of the nose surface, slightly proud of it (upper-front, one side). */
function band(phiStart: number, phiLen: number) {
  const prof = LEN_PROFILE.filter(([x]) => x >= 27.5 && x <= 30.4).map(([x, r]) => new THREE.Vector2(r * 1.012, x));
  const g = new THREE.LatheGeometry(prof, 12, phiStart, phiLen);
  g.rotateZ(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function planform(pts: [number, number][], thick: number, bevel = 0.12) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  g.translate(0, 0, -thick / 2);
  return g;
}

function useWindowsTex() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 2048; c.height = 32;
    const x = c.getContext("2d")!;
    x.clearRect(0, 0, 2048, 32);
    for (let i = 0; i < 88; i++) {
      const px = 30 + i * 22.6;
      if (i === 12 || i === 40 || i === 70) continue; // door gaps
      const lit = 0.6 + 0.4 * Math.abs(Math.sin(i * 12.9898));
      x.fillStyle = `rgba(255,${200 + 30 * lit},${140 + 40 * lit},${lit})`;
      x.beginPath(); x.roundRect(px, 9, 9, 14, 4); x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function useRegTex() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 96;
    const x = c.getContext("2d")!;
    x.fillStyle = "#2b2f36"; x.font = "bold 70px 'Liberation Mono', monospace"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("9M-MRO", 256, 50);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

const Engine: React.FC<{ z: number; m: Record<string, THREE.Material> }> = ({ z, m }) => {
  const nac = useMemo(() => lathe([[3.6, 1.62], [3.3, 1.9], [2.4, 2.0], [-0.5, 1.98], [-2.6, 1.6], [-3.4, 1.2], [-3.5, 0]], 32), []);
  const cone = useMemo(() => lathe([[-3.2, 0.75], [-4.4, 0.38], [-5.0, 0]], 20), []);
  return (
    <group position={[0.4, -2.35, z]}>
      <mesh geometry={nac} material={m.nacelle} />
      <mesh material={m.dark} position={[3.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}><circleGeometry args={[1.62, 32]} /></mesh>
      <mesh material={m.metal} position={[3.32, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.42, 0.7, 20]} /></mesh>
      <mesh geometry={cone} material={m.metal} />
      {/* pylon */}
      <mesh material={m.white} position={[-1.2, 1.55, 0]} rotation={[0, 0, 0.1]}><boxGeometry args={[5.6, 1.3, 0.5]} /></mesh>
    </group>
  );
};

const Bogie: React.FC<{ pos: [number, number, number]; m: Record<string, THREE.Material>; wheels: number; len: number }> = ({ pos, m, wheels, len }) => (
  <group position={pos}>
    <mesh material={m.metal} position={[0, -len / 2, 0]}><cylinderGeometry args={[0.16, 0.16, len, 10]} /></mesh>
    {Array.from({ length: wheels }, (_, i) => {
      const row = wheels > 2 ? Math.floor(i / 2) - (wheels / 2 - 1) / 2 : 0;
      const side = i % 2 ? 1 : -1;
      return (
        <mesh key={i} material={m.tyre} position={[row * 1.45, -len, side * 0.5]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.62, 0.62, 0.45, 18]} /></mesh>
      );
    })}
  </group>
);

export type LightState = { strobe: number; beacon: number; landing: number; cabin: number; nav: number };

/** Standard night lighting pattern at time t: double white strobe every 1.2 s, red beacon ~1 Hz. */
export function lightsAt(t: number, landing = 0, cabin = 1): LightState {
  const p = t % 1.2;
  const strobe = p < 0.05 ? 1 : p > 0.14 && p < 0.19 ? 0.85 : 0;
  const b = (t + 0.5) % 1.0;
  const beacon = b < 0.12 ? 1 : b < 0.3 ? Math.max(0, 1 - (b - 0.12) / 0.18) * 0.4 : 0;
  return { strobe, beacon, landing, cabin, nav: 1 };
}

export const B777: React.FC<{ env?: THREE.Texture | null; gear?: number; lights?: LightState; scaleGlow?: number }> = ({ env = null, gear = 1, lights, scaleGlow = 1 }) => {
  const winTex = useWindowsTex();
  const regTex = useRegTex();
  const m = useMemo(() => {
    const white = new THREE.MeshStandardMaterial({ color: "#e9ecef", roughness: 0.35, metalness: 0.15, envMap: env, envMapIntensity: 0.9 });
    const belly = new THREE.MeshStandardMaterial({ color: "#b9bec4", roughness: 0.4, metalness: 0.25, envMap: env, envMapIntensity: 0.8 });
    const wing = new THREE.MeshStandardMaterial({ color: "#c3c8ce", roughness: 0.45, metalness: 0.35, envMap: env, envMapIntensity: 0.8 });
    const nacelle = new THREE.MeshStandardMaterial({ color: "#d9dde1", roughness: 0.3, metalness: 0.4, envMap: env, envMapIntensity: 1.0, side: THREE.DoubleSide });
    const metal = new THREE.MeshStandardMaterial({ color: "#8e949a", roughness: 0.3, metalness: 0.85, envMap: env });
    const dark = new THREE.MeshStandardMaterial({ color: "#121417", roughness: 0.5, metalness: 0.4 });
    const tyre = new THREE.MeshStandardMaterial({ color: "#16171a", roughness: 0.9 });
    const glass = new THREE.MeshStandardMaterial({ color: "#0b0f14", roughness: 0.08, metalness: 0.9, envMap: env, envMapIntensity: 1.4 });
    const windows = new THREE.MeshBasicMaterial({ map: winTex, transparent: true, toneMapped: false, depthWrite: false });
    const reg = new THREE.MeshStandardMaterial({ map: regTex, transparent: true, roughness: 0.4 });
    return { white, belly, wing, nacelle, metal, dark, tyre, glass, windows, reg };
  }, [env, winTex, regTex]);
  const fus = useMemo(() => lathe(LEN_PROFILE, 48), []);
  // wing half (planform in x / span), root chord 13 m, 31.6° sweep, tip chord 2.5 m, trailing-edge kink
  const wingG = useMemo(() => planform([[5.2, 0], [-14.2, 30.4], [-16.6, 30.4], [-11.6, 10.5], [-8.6, 2.8], [-8.6, 0]], 0.55, 0.18), []);
  const tailG = useMemo(() => planform([[-21.8, 0], [-29.2, 10.6], [-31.3, 10.6], [-29.6, 0]], 0.3, 0.1), []);
  const finG = useMemo(() => planform([[-19.5, 0], [-28.9, 11.6], [-32.0, 11.6], [-31.4, 0]], 0.45, 0.12), []);
  const shield = useMemo(() => [band(Math.PI + 0.42, 0.62), band(2 * Math.PI - 1.04, 0.62)], []);
  const L = lights ?? lightsAt(0);
  winTex.needsUpdate = false;
  m.windows.opacity = L.cabin;
  const g = scaleGlow;
  return (
    <group>
      <mesh geometry={fus} material={m.white} />
      {/* belly fairing / wing box */}
      <mesh material={m.belly} position={[-2.2, -2.05, 0]} scale={[1, 0.2, 0.355]}><sphereGeometry args={[9.5, 32, 16]} /></mesh>
      {/* cockpit windows */}
      {shield.map((g, i) => <mesh key={i} geometry={g} material={m.glass} />)}
      {/* cabin windows both sides */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={m.windows} position={[5.5, 0.55, s * 3.112]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}><planeGeometry args={[37, 0.72]} /></mesh>
      ))}
      <mesh material={m.reg} position={[-17, 0.4, 2.97]} rotation={[0, 0, 0]}><planeGeometry args={[4.6, 0.86]} /></mesh>
      {/* wings, 6° dihedral */}
      {[1, -1].map((s) => (
        <group key={s} position={[0, -1.7, 0]} rotation={[-s * 0.1, 0, 0]} scale={[1, 1, s]}>
          <mesh geometry={wingG} material={m.wing} rotation={[Math.PI / 2, 0, 0]} />
          <Engine z={9.7} m={m} />
        </group>
      ))}
      {/* horizontal stabilisers, vertical fin */}
      {[1, -1].map((s) => (
        <group key={s} position={[0, 0.6, 0]} rotation={[-s * 0.12, 0, 0]} scale={[1, 1, s]}>
          <mesh geometry={tailG} material={m.white} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      <mesh geometry={finG} material={m.white} position={[0, 0.4, 0]} />
      {/* landing gear */}
      {gear > 0.02 ? (
        <group scale={[1, gear, 1]}>
          <Bogie pos={[-2.2, -2.6, 5.5]} m={m} wheels={6} len={2.5} />
          <Bogie pos={[-2.2, -2.6, -5.5]} m={m} wheels={6} len={2.5} />
          <Bogie pos={[24.5, -2.6, 0]} m={m} wheels={2} len={2.5} />
        </group>
      ) : null}
      {/* navigation / anti-collision / landing lights */}
      <Glow pos={[-15.9, -1.7 + 30.4 * 0.1, -30.6]} color="#ff2a1f" size={1.6 * g} intensity={0.9 * L.nav} />
      <Glow pos={[-15.9, -1.7 + 30.4 * 0.1, 30.6]} color="#26ff6a" size={1.6 * g} intensity={0.9 * L.nav} />
      <Glow pos={[-16.2, -1.7 + 30.4 * 0.1, -30.7]} color="#ffffff" size={7 * g} intensity={L.strobe} />
      <Glow pos={[-16.2, -1.7 + 30.4 * 0.1, 30.7]} color="#ffffff" size={7 * g} intensity={L.strobe} />
      <Glow pos={[-32.2, 0.2, 0]} color="#ffffff" size={4 * g} intensity={L.strobe * 0.8} />
      <Glow pos={[-2, 3.25, 0]} color="#ff2a10" size={3.2 * g} intensity={L.beacon} />
      <Glow pos={[-4, -3.45, 0]} color="#ff2a10" size={3.2 * g} intensity={L.beacon} />
      {L.landing > 0 ? (
        <>
          <Glow pos={[6.0, -1.9, 4.2]} color="#fff6e0" size={9 * g} intensity={L.landing} />
          <Glow pos={[6.0, -1.9, -4.2]} color="#fff6e0" size={9 * g} intensity={L.landing} />
          <Glow pos={[25.0, -4.2, 0]} color="#fff6e0" size={6 * g} intensity={L.landing * gear} />
        </>
      ) : null}
    </group>
  );
};
