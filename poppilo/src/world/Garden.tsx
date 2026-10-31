import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { grassTexture } from "../lib/textures";
import { rand } from "../lib/anim";

const sphere = new THREE.SphereGeometry(1, 32, 20);
const lowSphere = new THREE.SphereGeometry(1, 16, 12);

const SkyDome: React.FC = () => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color("#3fa9f5") }, horizon: { value: new THREE.Color("#d4f1ff") } },
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6,0.0,1.0); gl_FragColor = vec4(mix(horizon, top, pow(h,0.8)), 1.0); }",
      }),
    [],
  );
  return <mesh geometry={sphere} material={mat} scale={120} />;
};

/** Rounded stylised tree: trunk + clustered canopy balls. */
export const Tree: React.FC<{ p: [number, number, number]; size?: number; trunk?: number; hue?: number; fruit?: boolean }> = ({ p, size = 1, trunk = 0.22, hue = 0, fruit = false }) => {
  const mats = useMemo(() => {
    const greens = ["#4caf50", "#5cc35a", "#3f9e45"].map((c) => new THREE.Color(c).offsetHSL(hue, 0, 0));
    return {
      trunk: new THREE.MeshStandardMaterial({ color: "#8a5a35", roughness: 0.9 }),
      leaves: greens.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 })),
      fruit: new THREE.MeshPhysicalMaterial({ color: "#ff5a5a", roughness: 0.3, clearcoat: 1 }),
    };
  }, [hue]);
  const blobs: [number, number, number, number][] = [
    [0, 2.3, 0, 1.15], [-0.75, 1.95, 0.15, 0.8], [0.8, 2.0, 0.1, 0.85], [0.1, 2.0, 0.65, 0.75], [0.0, 2.9, -0.1, 0.75],
  ];
  return (
    <group position={p} scale={size}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[trunk * 0.8, trunk * 1.15, 1.9, 20]} />
        <primitive object={mats.trunk} attach="material" />
      </mesh>
      {blobs.map(([x, y, z, r], i) => (
        <mesh key={i} geometry={sphere} material={mats.leaves[i % 3]} position={[x, y, z]} scale={r} castShadow receiveShadow />
      ))}
      {fruit
        ? [[-0.5, 1.8, 0.85], [0.6, 2.2, 0.75], [0.1, 2.6, 0.9], [-0.9, 2.3, 0.5]].map((q, i) => (
            <mesh key={i} geometry={lowSphere} material={mats.fruit} position={q as [number, number, number]} scale={0.11} castShadow />
          ))
        : null}
    </group>
  );
};

/** Instanced flowers with gentle wind sway. */
const Flowers: React.FC<{ t: number }> = ({ t }) => {
  const count = 90;
  const data = useMemo(() => {
    const palette = ["#ff5c8a", "#ffd23f", "#b47cff", "#ff8a3d", "#ffffff", "#4fc3ff", "#ff4d4d"];
    const list: { x: number; z: number; h: number; c: THREE.Color; s: number; ph: number }[] = [];
    let k = 0;
    while (list.length < count) {
      k++;
      const x = (rand(k * 3.1) - 0.5) * 26;
      const z = -8 + rand(k * 7.7) * 13;
      if (Math.abs(x) < 3.6 && z > -1.8 && z < 2.2) continue; // keep the dance floor clear
      list.push({ x, z, h: 0.3 + rand(k * 1.3) * 0.25, c: new THREE.Color(palette[k % palette.length]), s: 0.75 + rand(k * 5.3) * 0.5, ph: rand(k) * 6 });
    }
    return list;
  }, []);
  const res = useMemo(
    () => ({
      stemGeo: new THREE.CylinderGeometry(0.018, 0.022, 1, 6),
      stemMat: new THREE.MeshStandardMaterial({ color: "#2f8f3a" }),
      petalMat: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      centerMat: new THREE.MeshStandardMaterial({ roughness: 0.5 }),
      yellow: new THREE.Color("#ffcf33"),
    }),
    [],
  );
  const stems = useRef<THREE.InstancedMesh>(null);
  const petals = useRef<THREE.InstancedMesh>(null);
  const centers = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    data.forEach((f, i) => {
      const sway = Math.sin(t * 1.7 + f.ph) * 0.12;
      e.set(0, 0, sway);
      q.setFromEuler(e);
      m.compose(v.set(f.x, (f.h * f.s) / 2, f.z), q, sc.set(1, f.h * f.s, 1));
      stems.current!.setMatrixAt(i, m);
      const hx = f.x - Math.sin(sway) * f.h * f.s;
      const hy = f.h * f.s;
      m.compose(v.set(hx, hy, f.z + 0.02), q, sc.set(0.07 * f.s, 0.07 * f.s, 0.05 * f.s));
      centers.current!.setMatrixAt(i, m);
      centers.current!.setColorAt(i, res.yellow);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + sway;
        m.compose(v.set(hx + Math.cos(a) * 0.1 * f.s, hy + Math.sin(a) * 0.1 * f.s, f.z), q, sc.set(0.075 * f.s, 0.075 * f.s, 0.035 * f.s));
        petals.current!.setMatrixAt(i * 5 + p, m);
        petals.current!.setColorAt(i * 5 + p, f.c);
      }
    });
    for (const r of [stems, petals, centers]) {
      r.current!.instanceMatrix.needsUpdate = true;
      if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true;
    }
  }, [t, data, res]);
  return (
    <>
      <instancedMesh ref={stems} args={[res.stemGeo, res.stemMat, count]} castShadow />
      <instancedMesh ref={petals} args={[lowSphere, res.petalMat, count * 5]} castShadow />
      <instancedMesh ref={centers} args={[lowSphere, res.centerMat, count]} />
    </>
  );
};

/** Little round bushes and grass tufts to texture the ground. */
const Bushes: React.FC = () => {
  const tufts = useRef<THREE.InstancedMesh>(null);
  const n = 260;
  const tuftRes = useMemo(() => ({ geo: new THREE.ConeGeometry(1, 1, 5), mat: new THREE.MeshStandardMaterial({ color: "#5fbf4a", roughness: 0.9 }) }), []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const x = (rand(i * 9.1) - 0.5) * 34;
      const z = -14 + rand(i * 4.3) * 20;
      if (Math.abs(x) < 3.4 && z > -1.6 && z < 2.4) {
        m.makeScale(0, 0, 0);
      } else {
        q.setFromEuler(new THREE.Euler(0, rand(i) * 6, 0));
        const s = 0.1 + rand(i * 2.2) * 0.12;
        m.compose(new THREE.Vector3(x, s * 0.6, z), q, new THREE.Vector3(s, s * 2.2, s));
      }
      tufts.current!.setMatrixAt(i, m);
    }
    tufts.current!.instanceMatrix.needsUpdate = true;
  }, []);
  const bush = useMemo(() => new THREE.MeshStandardMaterial({ color: "#46a84a", roughness: 0.8 }), []);
  const bushes: [number, number, number, number][] = [
    [-6.5, 0.35, -3, 0.7], [-5.8, 0.3, -2.6, 0.5], [6.2, 0.35, -4.5, 0.65], [3.2, 0.3, -2.7, 0.55], [2.6, 0.25, -2.4, 0.4], [-3.4, 0.3, -5.5, 0.6], [8.5, 0.4, -1, 0.7],
  ];
  return (
    <>
      <instancedMesh ref={tufts} args={[tuftRes.geo, tuftRes.mat, n]} receiveShadow />
      {bushes.map(([x, y, z, r], i) => (
        <mesh key={i} geometry={sphere} material={bush} position={[x, y, z]} scale={[r * 1.3, r, r]} castShadow receiveShadow />
      ))}
    </>
  );
};

const Cloud: React.FC<{ p: [number, number, number]; s: number }> = ({ p, s }) => {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.35, roughness: 1 }), []);
  return (
    <group position={p} scale={s}>
      {[[0, 0, 0, 1.2], [1.2, -0.2, 0, 0.9], [-1.2, -0.25, 0, 0.85], [0.5, 0.55, 0, 0.8], [-0.5, 0.45, 0.2, 0.75]].map(([x, y, z, r], i) => (
        <mesh key={i} geometry={sphere} material={m} position={[x, y, z]} scale={[r, r * 0.85, r * 0.8]} />
      ))}
    </group>
  );
};

const Butterfly: React.FC<{ t: number; seed: number; color: string }> = ({ t, seed, color }) => {
  const wing = useMemo(() => new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.5, emissive: color, emissiveIntensity: 0.2 }), [color]);
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a2a20" }), []);
  const a = t * (0.35 + seed * 0.05) + seed * 2;
  const x = Math.sin(a) * (4 + seed) + (seed % 2 ? 2 : -2);
  const z = -2.5 + Math.sin(a * 2) * 1.6 - seed * 0.6;
  const y = 1.9 + Math.sin(a * 3) * 0.4 + seed * 0.15;
  const heading = Math.atan2(Math.cos(a) * (4 + seed), Math.cos(a * 2) * 3.2);
  const flap = 0.25 + Math.abs(Math.sin(t * 14 + seed)) * 1.1;
  // Each wing is two lobes in a plane hinged along the body (the z axis).
  const Wing: React.FC<{ side: 1 | -1 }> = ({ side }) => (
    <group rotation={[0, 0, side * flap]}>
      <mesh geometry={sphere} material={wing} position={[side * 0.13, 0, 0.04]} scale={[0.13, 0.008, 0.1]} />
      <mesh geometry={sphere} material={wing} position={[side * 0.09, 0, -0.08]} scale={[0.08, 0.008, 0.07]} />
    </group>
  );
  return (
    <group position={[x, y, z]} rotation={[0, heading, 0]} scale={1.3}>
      <mesh geometry={sphere} material={body} scale={[0.025, 0.025, 0.12]} />
      <Wing side={1} />
      <Wing side={-1} />
    </group>
  );
};

const Rainbow: React.FC = () => {
  const colors = ["#ff4b4b", "#ff9a3c", "#ffe14d", "#58d16c", "#47b5ff", "#7a6bff"];
  return (
    <group position={[-8, -2, -48]}>
      {colors.map((c, i) => (
        <mesh key={c} position={[0, 0, 0]}>
          <torusGeometry args={[22 - i * 1.1, 0.55, 12, 96, Math.PI]} />
          <meshBasicMaterial color={c} transparent opacity={0.55} depthWrite={false} fog={false} />
        </mesh>
      ))}
    </group>
  );
};

export const Garden: React.FC<{ t: number }> = ({ t }) => {
  const grass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#78c955", roughness: 0.95, bumpMap: grassTexture(), bumpScale: 1.2 }), []);
  const hills = useMemo(() => ["#6cc04a", "#5db347", "#83cf5c", "#4fa840"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 })), []);
  return (
    <>
      <SkyDome />
      <fog attach="fog" args={["#d4f1ff", 28, 95]} />
      <hemisphereLight args={["#cfeeff", "#5fae4a", 1.05]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[7, 13, 9]}
        intensity={2.6}
        color="#fff3dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={5}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={45}
      />
      {/* sun */}
      <mesh position={[26, 30, -70]} geometry={sphere} scale={4}>
        <meshBasicMaterial color="#fff6b0" fog={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[90, 64]} />
        <primitive object={grass} attach="material" />
      </mesh>
      {[[-18, -6, -34, 14], [6, -7, -40, 18], [26, -5, -30, 12], [-34, -6, -22, 14], [16, -9, -22, 12]].map(([x, y, z, r], i) => (
        <mesh key={i} geometry={sphere} material={hills[i % 4]} position={[x, y, z]} scale={[r * 1.6, r * 0.75, r]} receiveShadow />
      ))}
      <Rainbow />
      <Tree p={[-7.5, 0, -6]} size={1.3} fruit />
      <Tree p={[-11, 0, -12]} size={1.6} hue={0.02} />
      <Tree p={[9.5, 0, -9]} size={1.5} hue={-0.02} fruit />
      <Tree p={[13, 0, -4]} size={1.2} />
      <Tree p={[-14, 0, -3]} size={1.1} hue={0.03} />
      {/* the big tree Toto hides behind */}
      <Tree p={[4.8, 0, -2.6]} size={1.25} trunk={0.6} fruit />
      <Flowers t={t} />
      <Bushes />
      {[[-14, 13, -40, 2.2, 0.25], [2, 15, -48, 2.8, 0.18], [18, 12, -36, 2.0, 0.3], [-30, 16, -50, 3.0, 0.2], [32, 15, -46, 2.4, 0.22]].map(([x, y, z, s, v], i) => (
        <Cloud key={i} p={[((x + t * v + 45) % 90) - 45, y, z]} s={s} />
      ))}
      {[["#ff7ac6", 0], ["#ffd43b", 1], ["#a77bff", 2], ["#ff9a3c", 3]].map(([c, s]) => (
        <Butterfly key={c as string} t={t} seed={s as number} color={c as string} />
      ))}
    </>
  );
};
