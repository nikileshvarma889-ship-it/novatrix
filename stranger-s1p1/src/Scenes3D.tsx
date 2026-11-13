import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useVideoConfig } from "remotion";
import { Glow } from "./three/Lights";

/* Original, atmospheric set pieces for a fan recap. Characters appear only as anonymous silhouettes;
   the "creature" is an original featureless shadow figure. No show logos, likenesses or creature designs. */

export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const sm = (a: number, b: number, x: number) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const lerp3 = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k) as V3;
const ease = (k: number) => k * k * (3 - 2 * k);
const hash = (i: number, s = 0) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
/** Deterministic electrical flicker: 1 = on, 0 = off. */
export const flick = (t: number, seed: number, amount: number) => {
  if (amount <= 0) return 1;
  const n = hash(Math.floor(t * 18), seed), m = hash(Math.floor(t * 5), seed + 9);
  return n < amount * (0.4 + 0.6 * m) ? 0.08 + 0.2 * hash(Math.floor(t * 40), seed) : 1;
};

const Cam: React.FC<{ pos: V3; look: V3; fov?: number; roll?: number }> = ({ pos, look, fov = 45, roll = 0 }) => {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  cam.position.set(...pos);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(...look);
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  return null;
};

export const Canvas3D: React.FC<{ children: React.ReactNode; exposure?: number }> = ({ children, exposure = 1.1 }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposure }} camera={{ fov: 45, near: 0.05, far: 600, position: [0, 2, 8] }} style={{ background: "#000" }}>
      {children}
    </ThreeCanvas>
  );
};

const Limb: React.FC<{ a: V3; b: V3; r: number; material: THREE.Material }> = ({ a, b, r, material }) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const mid = A.clone().add(B).multiplyScalar(0.5), dir = B.clone().sub(A);
  const len = Math.max(0.01, dir.length() - 2 * r);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return <mesh material={material} position={mid} quaternion={q}><capsuleGeometry args={[r, len, 4, 8]} /></mesh>;
};

/** Anonymous human silhouette (no face, no costume): scale 1 ≈ 1.75 m adult, 0.82 ≈ a child. */
export const Figure: React.FC<{ pos: V3; rotY?: number; scale?: number; walk?: number; t?: number; color?: string; arms?: "down" | "torch" }> = ({ pos, rotY = 0, scale = 1, walk = 0, t = 0, color = "#07080a", arms = "down" }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.9 }), [color]);
  const ph = Math.sin(t * 6) * walk;
  return (
    <group position={pos} rotation={[0, rotY, 0]} scale={scale}>
      <mesh material={mat} position={[0, 1.6, 0]}><sphereGeometry args={[0.12, 14, 10]} /></mesh>
      <Limb a={[0, 1.42, 0]} b={[0, 0.95, 0]} r={0.17} material={mat} />
      <Limb a={[-0.09, 0.92, 0]} b={[-0.1, 0.06, ph * 0.3]} r={0.07} material={mat} />
      <Limb a={[0.09, 0.92, 0]} b={[0.1, 0.06, -ph * 0.3]} r={0.07} material={mat} />
      <Limb a={[-0.2, 1.38, 0]} b={[-0.25, 0.9, -ph * 0.25]} r={0.055} material={mat} />
      {arms === "torch" ? <Limb a={[0.2, 1.38, 0]} b={[0.18, 1.12, 0.38]} r={0.055} material={mat} /> : <Limb a={[0.2, 1.38, 0]} b={[0.25, 0.9, ph * 0.25]} r={0.055} material={mat} />}
    </group>
  );
};

/** The original "shadow being": unnaturally tall and thin, featureless, long arms. Only ever seen as a silhouette. */
export const Shadow: React.FC<{ pos: V3; rotY?: number; t: number; opacity?: number; scale?: number }> = ({ pos, rotY = 0, t, opacity = 1, scale = 1 }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#000000", transparent: true }), []);
  mat.opacity = opacity;
  if (opacity <= 0.01) return null;
  const sway = Math.sin(t * 1.3) * 0.04;
  return (
    <group position={pos} rotation={[0, rotY, sway]} scale={scale}>
      <mesh material={mat} position={[0, 2.45, 0]} scale={[0.85, 1.25, 0.8]}><sphereGeometry args={[0.15, 12, 10]} /></mesh>
      <Limb a={[0, 2.25, 0]} b={[0, 1.35, 0]} r={0.16} material={mat} />
      <Limb a={[-0.08, 1.32, 0]} b={[-0.14, 0.04, 0.05]} r={0.06} material={mat} />
      <Limb a={[0.08, 1.32, 0]} b={[0.16, 0.04, -0.05]} r={0.06} material={mat} />
      <Limb a={[-0.22, 2.15, 0]} b={[-0.42, 0.85, 0.15 + sway]} r={0.045} material={mat} />
      <Limb a={[0.22, 2.15, 0]} b={[0.4, 0.9, 0.1 - sway]} r={0.045} material={mat} />
    </group>
  );
};

/** Additive cone of light in haze (torch, headlamp, bulb). Origin at the lamp, pointing along -Z of its group. */
export const Beam: React.FC<{ len: number; radius: number; color: string; intensity: number }> = ({ len, radius, color, intensity }) => {
  const { geo, mat } = useMemo(() => {
    const g = new THREE.ConeGeometry(radius, len, 28, 1, true); g.translate(0, -len / 2, 0); g.rotateX(Math.PI / 2);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uC: { value: new THREE.Color(color) }, uI: { value: 1 }, uLen: { value: len } },
      vertexShader: `varying float vD; varying vec3 vN; varying vec3 vV; void main(){ vD = -position.z; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uC; uniform float uI; uniform float uLen; varying float vD; varying vec3 vN; varying vec3 vV; void main(){ float fall = pow(1.0 - clamp(vD/uLen,0.0,1.0), 1.6); float edge = pow(abs(dot(vN,vV)), 1.2); gl_FragColor = vec4(uC*fall*edge*uI*0.35, 1.0); }`,
    });
    return { geo: g, mat: m };
  }, [len, radius, color]);
  mat.uniforms.uI.value = intensity;
  return intensity > 0.01 ? <mesh geometry={geo} material={mat} renderOrder={6} /> : null;
};

/** Rain streaks (deterministic). */
const RainField: React.FC<{ t: number; center: V3; area: V3; count?: number; color?: string; speed?: number }> = ({ t, center, area, count = 1600, color = "#a9b8cc", speed = 14 }) => {
  const { geo, mat, seeds } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
    return { geo, mat, seeds: Array.from({ length: count }, (_, i) => [hash(i, 1), hash(i, 2), hash(i, 3)]) };
  }, [count, color]);
  const p = geo.attributes.position.array as Float32Array;
  seeds.forEach(([a, b, c], i) => {
    const x = center[0] + (a - 0.5) * area[0], z = center[2] + (c - 0.5) * area[2];
    const y = center[1] + area[1] / 2 - (((b * area[1]) + t * speed) % area[1]);
    p.set([x, y, z, x - 0.04, y - 0.55, z], i * 6);
  });
  geo.attributes.position.needsUpdate = true;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(...center), 200);
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />;
};

/** A forest of dark trunks around a corridor (road / clearing). */
const Trees: React.FC<{ seed: number; xMin: number; xMax: number; zMin: number; zMax: number; gap: number; count?: number; color?: string }> = ({ seed, xMin, xMax, zMin, zMax, gap, count = 160, color = "#121410" }) => {
  const { mesh } = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.16, 0.26, 16, 7); geo.translate(0, 8, 0);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    const m = new THREE.InstancedMesh(geo, mat, count);
    const o = new THREE.Object3D(); let n = 0;
    for (let i = 0; n < count && i < count * 6; i++) {
      const x = xMin + hash(i, seed) * (xMax - xMin), z = zMin + hash(i, seed + 1) * (zMax - zMin);
      if (Math.abs(x) < gap) continue;
      o.position.set(x, 0, z); o.rotation.set((hash(i, seed + 3) - 0.5) * 0.08, hash(i, seed + 4) * 6, (hash(i, seed + 5) - 0.5) * 0.08);
      const s = 0.7 + hash(i, seed + 2) * 1.1; o.scale.set(s, 0.8 + hash(i, seed + 6) * 0.6, s); o.updateMatrix(); m.setMatrixAt(n++, o.matrix);
    }
    m.count = n;
    return { mesh: m };
  }, [seed, xMin, xMax, zMin, zMax, gap, count, color]);
  return <primitive object={mesh} />;
};

const Ground: React.FC<{ color: string; size?: number; rough?: number; y?: number }> = ({ color, size = 400, rough = 0.95, y = 0 }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}><planeGeometry args={[size, size]} /><meshStandardMaterial color={color} roughness={rough} /></mesh>
);

// ====================================================================== S1: the lab
/** Long institutional corridor along -Z, fluorescent panels that fail one by one; elevator at the end. */
export const Lab: React.FC<{ t: number; d: number; doorsAt: number }> = ({ t, d, doorsAt }) => {
  const m = useMemo(() => ({
    wall: new THREE.MeshStandardMaterial({ color: "#7d8a80", roughness: 0.75 }),
    floor: new THREE.MeshStandardMaterial({ color: "#3a3f3c", roughness: 0.25, metalness: 0.1 }),
    ceil: new THREE.MeshStandardMaterial({ color: "#5f6862", roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: "#8a9096", roughness: 0.35, metalness: 0.8 }),
    panel: new THREE.MeshBasicMaterial({ color: "#e8f3ec", toneMapped: false }),
    red: new THREE.MeshBasicMaterial({ color: "#ff2a1a", toneMapped: false }),
    inner: new THREE.MeshStandardMaterial({ color: "#2b2f2e", roughness: 0.6, metalness: 0.4 }),
  }), []);
  const shot2 = t > doorsAt - 1.6;
  const k = ease(clamp01(t / (doorsAt - 1.6)));
  const fail = sm(0.5, doorsAt - 2, t);
  const lights = Array.from({ length: 7 }, (_, i) => -2 - i * 5);
  const open = sm(doorsAt, doorsAt + 1.4, t);
  const alarm = 0.5 + 0.5 * Math.sin(t * 7);
  const shadowSeen = t > 2.4 && t < doorsAt - 1.7 && flick(t, 5, 0.6) < 0.5;
  return (
    <>
      {shot2 ? <Cam pos={lerp3([0, 1.6, -26], [0, 1.6, -29.5], ease(clamp01((t - doorsAt + 1.6) / (d - doorsAt + 1.6))))} look={[0, 1.4, -40]} fov={48} roll={Math.sin(t * 9) * 0.002} />
        : <Cam pos={lerp3([0.4, 1.55, 2], [0.1, 1.6, -10], k)} look={[0, 1.4, -36]} fov={52} roll={Math.sin(t * 2) * 0.004} />}
      <color attach="background" args={["#010202"]} />
      <fogExp2 attach="fog" args={["#0b100d", 0.045]} />
      <ambientLight intensity={0.05} color="#9fb5a8" />
      {/* corridor shell */}
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -18]}><planeGeometry args={[3.2, 46]} /></mesh>
      <mesh material={m.ceil} rotation={[Math.PI / 2, 0, 0]} position={[0, 3, -18]}><planeGeometry args={[3.2, 46]} /></mesh>
      <mesh material={m.wall} rotation={[0, Math.PI / 2, 0]} position={[-1.6, 1.5, -18]}><planeGeometry args={[46, 3]} /></mesh>
      <mesh material={m.wall} rotation={[0, -Math.PI / 2, 0]} position={[1.6, 1.5, -18]}><planeGeometry args={[46, 3]} /></mesh>
      {/* doors along the walls */}
      {[-6, -14, -22].map((z) => [-1.59, 1.59].map((x) => <mesh key={`${x}${z}`} material={m.inner} position={[x, 1.05, z]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}><planeGeometry args={[1, 2.1]} /></mesh>))}
      {/* fluorescent panels */}
      {lights.map((z, i) => {
        const on = i >= 5 ? flick(t, i, 0.2 + fail * 0.7) : flick(t, i, fail * (0.15 + 0.12 * i)) * (i === 3 && fail > 0.7 ? 0 : 1);
        return (
          <group key={i}>
            <mesh position={[0, 2.99, z]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.5, 1.6]} /><meshBasicMaterial color={on > 0.5 ? "#e6f2ea" : "#2a302c"} toneMapped={false} /></mesh>
            <pointLight position={[0, 2.7, z]} intensity={on * 7} distance={9} decay={1.6} color="#d9efe2" />
            <Glow pos={[0, 2.92, z]} color="#d8f0e0" size={2.4} intensity={on * 0.35} fog />
          </group>
        );
      })}
      {/* the thing at the end of the hall, seen only when the lights stutter */}
      {!shot2 && <Shadow pos={[0.3, 0, -24]} t={t} opacity={shadowSeen ? 0.95 : 0} />}
      {/* elevator */}
      <group position={[0, 0, -32]}>
        <mesh material={m.steel} position={[0, 1.5, 0.01]}><planeGeometry args={[3.2, 3]} /></mesh>
        <mesh material={m.inner} position={[0, 1.15, -1.2]}><boxGeometry args={[1.8, 2.3, 0.05]} /></mesh>
        <mesh material={m.inner} position={[-0.9, 1.15, -0.6]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[1.2, 2.3]} /></mesh>
        <mesh material={m.inner} position={[0.9, 1.15, -0.6]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[1.2, 2.3]} /></mesh>
        <mesh material={m.inner} position={[0, 0.01, -0.6]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.8, 1.2]} /></mesh>
        {/* doors slide apart: nobody inside */}
        <mesh material={m.steel} position={[-0.45 - open * 0.9, 1.15, 0.05]}><boxGeometry args={[0.9, 2.3, 0.04]} /></mesh>
        <mesh material={m.steel} position={[0.45 + open * 0.9, 1.15, 0.05]}><boxGeometry args={[0.9, 2.3, 0.04]} /></mesh>
        <pointLight position={[0, 2.1, -0.6]} intensity={open * 3 * flick(t, 11, 0.35)} distance={4} color="#f1e2c0" />
        <mesh material={m.red} position={[0, 2.6, 0.06]}><boxGeometry args={[0.5, 0.12, 0.02]} /></mesh>
        <pointLight position={[0, 2.6, 0.6]} intensity={2 + alarm * 6 * sm(doorsAt - 2, doorsAt, t)} distance={8} color="#ff2a1a" />
        <Glow pos={[0, 2.6, 0.2]} color="#ff2a1a" size={1.4} intensity={0.5 + alarm * 0.5} fog />
      </group>
    </>
  );
};

// ====================================================================== S2: the basement game
const d20 = (() => { const g = new THREE.IcosahedronGeometry(0.035, 0); g.computeVertexNormals(); return g; })();
export const Basement: React.FC<{ t: number; d: number; rollAt: number }> = ({ t, d, rollAt }) => {
  const m = useMemo(() => ({
    wood: new THREE.MeshStandardMaterial({ color: "#5a3b22", roughness: 0.6 }),
    paper: new THREE.MeshStandardMaterial({ color: "#e9e1c8", roughness: 0.9 }),
    die: new THREE.MeshStandardMaterial({ color: "#a1171c", roughness: 0.25, metalness: 0.1 }),
    mini: new THREE.MeshStandardMaterial({ color: "#8a8f96", roughness: 0.4, metalness: 0.7 }),
    wall: new THREE.MeshStandardMaterial({ color: "#3b3127", roughness: 1 }),
  }), []);
  const grid = useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d")!;
    x.fillStyle = "#ece4cb"; x.fillRect(0, 0, 512, 512); x.strokeStyle = "rgba(60,90,140,0.35)"; x.lineWidth = 1;
    for (let i = 0; i <= 512; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
    x.strokeStyle = "rgba(40,30,20,0.8)"; x.lineWidth = 3; x.strokeRect(96, 120, 192, 144); x.strokeRect(288, 192, 120, 168); x.strokeRect(144, 264, 96, 120);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  // die: thrown at rollAt, bounces twice and settles
  const r = Math.max(0, t - rollAt), fly = clamp01(r / 1.6);
  const x = 0.55 - 0.6 * (1 - Math.pow(1 - fly, 2)), z = 0.25 - 0.28 * fly;
  const bounce = Math.abs(Math.sin(fly * Math.PI * 3)) * 0.18 * Math.pow(1 - fly, 1.6);
  const spin = (1 - Math.pow(1 - fly, 3)) * 14;
  const k = ease(clamp01(t / d));
  const lamp = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 3.1);
  return (
    <>
      <Cam pos={lerp3([0.95, 1.25, 0.95], [0.38, 0.98, 0.42], k)} look={lerp3([0, 0.82, 0], [-0.04, 0.78, -0.02], k)} fov={40} />
      <color attach="background" args={["#050302"]} />
      <ambientLight intensity={0.06} color="#6b5440" />
      <pointLight position={[0.2, 1.6, 0.1]} intensity={9 * lamp} distance={5} color="#ffb874" />
      <Glow pos={[0.2, 1.62, 0.1]} color="#ffb874" size={0.5} intensity={0.7 * lamp} />
      <mesh material={m.wood} position={[0, 0.74, 0]}><boxGeometry args={[1.8, 0.06, 1.2]} /></mesh>
      <mesh material={m.wall} position={[0, 1.4, -1.6]}><planeGeometry args={[6, 3]} /></mesh>
      <mesh position={[-0.15, 0.772, -0.05]} rotation={[-Math.PI / 2, 0, 0.12]}><planeGeometry args={[0.7, 0.7]} /><meshStandardMaterial map={grid} roughness={0.95} /></mesh>
      {/* pewter miniatures and a dungeon-master screen */}
      {[[-0.32, -0.18], [-0.2, 0.08], [0.05, -0.2], [0.12, 0.05]].map(([px, pz], i) => (
        <group key={i} position={[px, 0.775, pz]}><mesh material={m.mini} position={[0, 0.005, 0]}><cylinderGeometry args={[0.022, 0.022, 0.01, 14]} /></mesh><mesh material={m.mini} position={[0, 0.04, 0]}><capsuleGeometry args={[0.012, 0.04, 4, 8]} /></mesh></group>
      ))}
      <mesh material={m.wood} position={[-0.55, 0.88, -0.3]} rotation={[0, 0.5, 0]}><boxGeometry args={[0.5, 0.24, 0.01]} /></mesh>
      <mesh material={m.die} geometry={d20} position={[t < rollAt ? 0.62 : x, 0.84 + (t < rollAt ? 0.18 + Math.sin(t * 8) * 0.01 : bounce), t < rollAt ? 0.3 : z]} rotation={[spin * 0.7, spin, spin * 0.4]} />
      {/* the hands of four players stay out of frame: only their shadows */}
      {[[-1.2, 0.3], [1.1, -0.5], [-0.6, -1.1], [0.7, 0.9]].map(([px, pz], i) => <Figure key={i} pos={[px, 0, pz]} rotY={Math.atan2(-px, -pz)} scale={0.82} color="#0d0906" />)}
    </>
  );
};

// ====================================================================== S3: the ride home + the shed
export const Road: React.FC<{ t: number; d: number; seeAt: number; crashAt: number; shedAt: number }> = ({ t, d, seeAt, crashAt, shedAt }) => {
  const asphalt = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1c1f22", roughness: 0.85 }), []);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7e1d1d", roughness: 0.4, metalness: 0.6 }), []);
  const tire = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0b0b0b", roughness: 0.8 }), []);
  if (t >= shedAt) return <Shed t={t - shedAt} d={d - shedAt} />;
  const riding = t < crashAt;
  const z = -Math.min(t, crashAt) * 6.5;               // bike moves along -Z
  const lamp = flick(t, 3, sm(seeAt - 1.5, seeAt, t) * 0.8);
  const swerve = sm(crashAt - 0.5, crashAt, t);
  const shake = riding ? Math.sin(t * 31) * 0.004 + swerve * Math.sin(t * 50) * 0.03 : 0;
  const after = t - crashAt;
  return (
    <>
      {riding
        ? <Cam pos={[0.15 + swerve * 0.4, 1.25 - swerve * 0.3, z]} look={[swerve * 1.2, 1.0 - swerve * 0.6, z - 12]} fov={50} roll={shake + swerve * 0.35} />
        : <Cam pos={[1.4 - after * 0.08, 0.55, -crashAt * 6.5 + 2.4]} look={[0, 0.25, -crashAt * 6.5 - 0.5]} fov={42} />}
      <color attach="background" args={["#1b2638"]} />
      <fogExp2 attach="fog" args={["#1b2638", 0.06]} />
      <ambientLight intensity={0.18} color="#5a72a0" />
      <directionalLight position={[-20, 30, -10]} intensity={0.8} color="#8aa3d6" />
      <Ground color="#0c100b" />
      <mesh material={asphalt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -60]}><planeGeometry args={[4, 200]} /></mesh>
      <Trees seed={7} xMin={-30} xMax={30} zMin={-130} zMax={20} gap={3.2} count={260} />
      {/* headlamp: with the rider, or lying on the road after the crash */}
      {riding ? (
        <group position={[0.15, 0.95, z - 0.4]} rotation={[-0.08, 0, 0]}>
          <spotLight intensity={lamp * 30} distance={30} angle={0.42} penumbra={0.6} decay={1.4} color="#fff1cc" position={[0, 0, 0]} target-position={[0, -1.6, -12]} />
          <Beam len={18} radius={4.5} color="#fff3d6" intensity={lamp * 0.6} />
        </group>
      ) : null}
      {/* the shadow being in the road ahead */}
      <Shadow pos={[0.2, 0, -seeAt * 6.5 - 12]} t={t} opacity={riding && t > seeAt ? (lamp > 0.5 ? 1 : 0.2) : 0} scale={1.05} />
      {/* the crashed bike */}
      {!riding && (
        <group position={[0, 0.06, -crashAt * 6.5 - 0.5]} rotation={[0, 0.7, Math.PI / 2 - 0.05]}>
          {[-0.52, 0.52].map((wz, i) => <mesh key={i} material={tire} position={[0, wz, 0]} rotation={[0, after * (i ? 9 : 0) * Math.exp(-after * 0.3), 0]}><torusGeometry args={[0.3, 0.025, 8, 28]} /></mesh>)}
          <mesh material={metal} position={[0, 0, 0]}><boxGeometry args={[0.03, 1.0, 0.04]} /></mesh>
          <mesh material={metal} position={[0, 0.2, 0.18]} rotation={[0.6, 0, 0]}><boxGeometry args={[0.03, 0.5, 0.04]} /></mesh>
          <group position={[0, 0.55, 0.2]} rotation={[Math.PI / 2, 0, -Math.PI / 2]}>
            <spotLight intensity={flick(after, 8, 0.45) * 18} distance={12} angle={0.5} penumbra={0.7} color="#fff1cc" target-position={[0, -5, 0]} />
            <Glow pos={[0, 0, 0]} color="#fff1cc" size={0.6} intensity={flick(after, 8, 0.45)} fog />
          </group>
        </group>
      )}
    </>
  );
};
/** The shed: one hanging bulb flickers, a shadow crosses, the light dies. */
const Shed: React.FC<{ t: number; d: number }> = ({ t, d }) => {
  const plank = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3d3125", roughness: 1 }), []);
  const out = sm(d - 0.45, d - 0.25, t);
  const bulb = Math.max(0.35, flick(t, 13, 0.3)) * (1 - out);
  const swing = Math.sin(t * 2.2) * 0.12;
  return (
    <>
      <Cam pos={[0.9, 1.45, 2.6 - t * 0.12]} look={[-0.2, 1.4, 0]} fov={46} roll={0.01} />
      <color attach="background" args={["#000"]} />
      <ambientLight intensity={0.07} color="#7080a0" />
      <mesh material={plank} position={[0, 1.5, -1.5]}><planeGeometry args={[6, 3]} /></mesh>
      <mesh material={plank} rotation={[0, Math.PI / 2, 0]} position={[-2.2, 1.5, 0]}><planeGeometry args={[6, 3]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[8, 8]} /><meshStandardMaterial color="#1d1712" roughness={1} /></mesh>
      {/* shelves, a rack of tools */}
      {[0.9, 1.5].map((y) => <mesh key={y} material={plank} position={[-1.2, y, -1.35]}><boxGeometry args={[1.6, 0.04, 0.28]} /></mesh>)}
      <group position={[Math.sin(swing) * 0.4, 2.5, -0.2]}>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.005, 0.005, 0.5, 4]} /><meshBasicMaterial color="#111" /></mesh>
        <Glow pos={[0, 0, 0]} color="#ffd9a0" size={1.2} intensity={bulb} />
        <pointLight intensity={bulb * 6} distance={7} decay={1.5} color="#ffcf8a" />
      </group>
      {/* someone backs against the wall; a long shadow fills the doorway behind */}
      <Figure pos={[-0.6, 0, -0.9]} rotY={0.4} scale={0.8} color="#0a0806" />
      <Shadow pos={[1.4, 0, -0.6]} t={t} opacity={sm(0.3, 0.8, t)} scale={0.95} />
    </>
  );
};

// ====================================================================== S4: the morning house
export const House: React.FC<{ t: number; d: number }> = ({ t, d }) => {
  const m = useMemo(() => ({
    wall: new THREE.MeshStandardMaterial({ color: "#6b5a46", roughness: 0.9 }),
    phone: new THREE.MeshStandardMaterial({ color: "#c8b48e", roughness: 0.35 }),
    cord: new THREE.MeshStandardMaterial({ color: "#c8b48e", roughness: 0.4 }),
  }), []);
  const cord = useMemo(() => {
    const pts = Array.from({ length: 160 }, (_, i) => { const k = i / 159; return new THREE.Vector3(Math.cos(k * 60) * 0.03, -k * 0.9, Math.sin(k * 60) * 0.03 + k * 0.1); });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.006, 5, false);
  }, []);
  const lampOn = flick(t, 21, 0.35);
  const k = ease(clamp01(t / d));
  const sway = Math.sin(t * 1.6) * 0.25 * Math.exp(-t * 0.15);
  return (
    <>
      <Cam pos={lerp3([0.9, 1.5, 1.6], [0.35, 1.35, 0.95], k)} look={[0, 1.2, 0]} fov={42} />
      <color attach="background" args={["#0b0b0b"]} />
      <ambientLight intensity={0.12} color="#aab4c4" />
      <directionalLight position={[-3, 3, 4]} intensity={0.9} color="#c9d4e4" />
      <mesh material={m.wall} position={[0, 1.5, -0.05]}><planeGeometry args={[6, 3.5]} /></mesh>
      {/* wall phone (generic 1980s style) with the receiver hanging off the hook */}
      <group position={[0, 1.55, 0]}>
        <mesh material={m.phone}><boxGeometry args={[0.18, 0.28, 0.07]} /></mesh>
        {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[-0.045 + (i % 3) * 0.045, 0.04 - Math.floor(i / 3) * 0.04, 0.037]}><boxGeometry args={[0.03, 0.025, 0.01]} /><meshStandardMaterial color="#e9e0cc" /></mesh>)}
      </group>
      <group position={[0.06, 1.42, 0.04]} rotation={[0, 0, sway]}>
        <mesh geometry={cord} material={m.cord} />
        <group position={[0, -0.95, 0.12]} rotation={[0.2, 0, 0.3]}><mesh material={m.phone}><capsuleGeometry args={[0.03, 0.17, 4, 10]} /></mesh></group>
      </group>
      {/* a "MISSING" flyer with an empty photo box, and lights that stutter */}
      <mesh position={[-0.75, 1.5, 0]}><planeGeometry args={[0.42, 0.56]} /><meshStandardMaterial color="#efe9dc" /></mesh>
      <pointLight position={[0.8, 2.2, 0.8]} intensity={lampOn * 5} distance={5} color="#ffc98a" />
      <Glow pos={[0.8, 2.2, 0.8]} color="#ffc98a" size={0.6} intensity={lampOn * 0.8} />
    </>
  );
};

// ====================================================================== S5: the police search
export const Search: React.FC<{ t: number; d: number }> = ({ t, d }) => {
  const car = useMemo(() => ({ body: new THREE.MeshStandardMaterial({ color: "#1b232c", roughness: 0.45, metalness: 0.5 }), glass: new THREE.MeshStandardMaterial({ color: "#0a0d10", roughness: 0.1, metalness: 0.9 }) }), []);
  const k = ease(clamp01(t / d));
  const red = Math.max(0, Math.sin(t * 9)), blue = Math.max(0, Math.sin(t * 9 + Math.PI));
  const torch = (i: number): V3 => [-4 + i * 2.2, 1.35, -9 - i * 1.5 + t * 0.6];
  return (
    <>
      <Cam pos={lerp3([5, 1.7, 6], [3.4, 1.6, 3.8], k)} look={[-1, 1.2, -6]} fov={46} />
      <color attach="background" args={["#a6aeb3"]} />
      <fogExp2 attach="fog" args={["#8f989e", 0.08]} />
      <ambientLight intensity={0.5} color="#b8c2c9" />
      <directionalLight position={[10, 20, 5]} intensity={0.6} color="#dfe6ea" />
      <Ground color="#2f3426" />
      <Trees seed={19} xMin={-40} xMax={40} zMin={-60} zMax={-5} gap={0} count={220} color="#1c1d18" />
      {/* boxy cruiser with a flashing light bar */}
      <group position={[2.2, 0, -1]} rotation={[0, -0.6, 0]}>
        <mesh material={car.body} position={[0, 0.6, 0]}><boxGeometry args={[1.8, 0.6, 4.6]} /></mesh>
        <mesh material={car.glass} position={[0, 1.08, -0.2]}><boxGeometry args={[1.6, 0.42, 2.2]} /></mesh>
        <mesh position={[-0.35, 1.34, -0.2]}><boxGeometry args={[0.6, 0.1, 0.25]} /><meshBasicMaterial color={red > 0.5 ? "#ff2020" : "#401010"} toneMapped={false} /></mesh>
        <mesh position={[0.35, 1.34, -0.2]}><boxGeometry args={[0.6, 0.1, 0.25]} /><meshBasicMaterial color={blue > 0.5 ? "#2050ff" : "#101840"} toneMapped={false} /></mesh>
        <pointLight position={[-0.35, 1.6, -0.2]} intensity={red * 25} distance={14} color="#ff2a20" />
        <pointLight position={[0.35, 1.6, -0.2]} intensity={blue * 25} distance={14} color="#2a5cff" />
      </group>
      {/* a line of searchers walking through the trees */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i}>
          <Figure pos={[torch(i)[0], 0, torch(i)[2]]} rotY={Math.PI} walk={1} t={t + i} arms="torch" color="#14161a" />
          <group position={[torch(i)[0] + 0.18, 1.12, torch(i)[2] - 0.38]} rotation={[0.25, Math.sin(t * 0.8 + i) * 0.3, 0]}><Beam len={7} radius={1.4} color="#f4f0e2" intensity={0.25} /></group>
        </group>
      ))}
    </>
  );
};

// ====================================================================== S6: the rain
export const RainWoods: React.FC<{ t: number; d: number; girlAt: number }> = ({ t, d, girlAt }) => {
  const k = ease(clamp01(t / d));
  const seen = sm(girlAt, girlAt + 1.2, t);
  const handheld: V3 = [Math.sin(t * 1.7) * 0.03, Math.sin(t * 2.3) * 0.02, 0];
  const pos = lerp3([0.4, 1.5, 7], [0.1, 1.45, 2.4], k);
  const lightning = (t > girlAt + 2 && t < girlAt + 2.25) || (t > d - 3 && t < d - 2.85) ? 1 : 0;
  // three torches sweep, then all settle on the figure
  const aim = (i: number) => (1 - seen) * Math.sin(t * (0.9 + i * 0.2) + i * 2) * 0.6 + seen * [-0.17, 0, 0.17][i] * -1;
  return (
    <>
      <Cam pos={[pos[0] + handheld[0], pos[1] + handheld[1], pos[2]]} look={[0, 1.0, -6]} fov={44} roll={handheld[0] * 0.3} />
      <color attach="background" args={["#020306"]} />
      <fogExp2 attach="fog" args={["#070b12", 0.09]} />
      <ambientLight intensity={0.035 + lightning * 0.8} color="#6c80a8" />
      <directionalLight position={[-10, 20, 10]} intensity={0.2 + lightning * 3} color="#9bb2e0" />
      <Ground color="#0d110c" rough={0.35} />
      <Trees seed={33} xMin={-30} xMax={30} zMin={-50} zMax={4} gap={2.5} count={240} />
      <RainField t={t} center={[0, 5, 0]} area={[16, 12, 16]} count={1800} />
      {/* three friends with torches (silhouettes, seen from behind) */}
      {[-0.9, 0, 0.9].map((x, i) => (
        <group key={i}>
          <Figure pos={[x, 0, 1.2 - pos[2] * 0 + (k * -3)]} rotY={Math.PI} scale={0.8} walk={1 - seen} t={t + i} arms="torch" color="#06070a" />
          <group position={[x + 0.15, 0.92, 0.85 + k * -3]} rotation={[0.06, aim(i), 0]}>
            <spotLight intensity={20} distance={18} angle={0.3} penumbra={0.6} color="#fff6dd" target-position={[0, -0.6, -10]} />
            <Beam len={12} radius={2.2} color="#f8f2df" intensity={0.55} />
          </group>
        </group>
      ))}
      {/* a small, still figure in the rain between the trees */}
      <Figure pos={[0, 0, -6.5]} scale={0.78} color="#0b0c10" />
      <pointLight position={[0, 1.4, -5]} intensity={seen * 4} distance={5} color="#fff4d8" />
    </>
  );
};
