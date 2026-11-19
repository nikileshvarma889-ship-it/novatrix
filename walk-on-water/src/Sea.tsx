import React, { useMemo } from "react";
import * as THREE from "three";
import { Glow } from "./three/Lights";
import { Cam, clamp01, ease, hash, lerp3, Limb, RainField, sm, type V3 } from "./Scenes3D";

/* Storm on the Sea of Galilee: a wave-shaded sea, a wooden fishing boat, robed figures. */

// ------------------------------------------------------------------ waves (same formula on CPU and GPU)
const WAVES: [number, number, number, number][] = [
  // wavelength, amplitude, direction (rad), speed factor
  [22, 0.95, 0.3, 1.0], [13, 0.6, -0.4, 1.0], [8, 0.38, 0.9, 1.0], [5, 0.2, -1.2, 1.0], [3, 0.1, 0.1, 1.0], [1.8, 0.05, 1.7, 1.0],
];
export const waveH = (x: number, z: number, t: number, storm: number) => {
  let h = 0;
  WAVES.forEach(([L, A, d, s], i) => {
    const k = (2 * Math.PI) / L, w = Math.sqrt(9.8 * k) * s;
    h += A * storm * Math.sin(k * (Math.cos(d) * x + Math.sin(d) * z) - w * t + i * 1.7);
  });
  return h;
};
const GLSL_WAVES = WAVES.map(([L, A, d, s], i) => {
  const k = (2 * Math.PI) / L, w = Math.sqrt(9.8 * k) * s;
  return `h += ${A.toFixed(3)} * uStorm * sin(${k.toFixed(5)} * (${Math.cos(d).toFixed(5)} * p.x + ${Math.sin(d).toFixed(5)} * p.y) - ${w.toFixed(5)} * uT + ${(i * 1.7).toFixed(3)});`;
}).join("\n");

export const Ocean: React.FC<{ t: number; storm: number; flash: number; moon?: number; center?: [number, number] }> = ({ t, storm, flash, moon = 0.25, center = [0, 0] }) => {
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(160, 160, 320, 320); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uStorm: { value: 1 }, uFlash: { value: 0 }, uMoon: { value: 0.25 }, uOff: { value: new THREE.Vector2() }, uFog: { value: new THREE.Color("#0b121a") }, uFogD: { value: 0.035 } },
      vertexShader: `uniform float uT; uniform float uStorm; uniform vec2 uOff; varying vec3 vW; varying vec3 vN; varying float vH;
        float H(vec2 p){ float h = 0.0; ${GLSL_WAVES} return h; }
        void main(){ vec3 p = position; p.xz += uOff; float h = H(p.xz); float e = 0.15;
          vec3 n = normalize(vec3(H(p.xz - vec2(e,0.0)) - H(p.xz + vec2(e,0.0)), 2.0*e, H(p.xz - vec2(0.0,e)) - H(p.xz + vec2(0.0,e))));
          p.y = h; vH = h / max(uStorm, 0.05); vN = n; vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uFlash; uniform float uMoon; uniform vec3 uFog; uniform float uFogD; varying vec3 vW; varying vec3 vN; varying float vH;
        void main(){ vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          vec3 deep = vec3(0.006, 0.03, 0.045), sky = mix(vec3(0.13, 0.17, 0.23), vec3(0.75, 0.82, 0.95), uFlash);
          vec3 col = mix(deep, sky, fres * 0.85);
          vec3 L = normalize(vec3(-0.3, 0.6, -1.0)); vec3 R = reflect(-L, N);
          col += pow(max(dot(R, V), 0.0), 60.0) * vec3(0.8, 0.85, 1.0) * (uMoon * 1.6 + uFlash * 1.5); col += pow(max(dot(R, V), 0.0), 8.0) * vec3(0.05, 0.07, 0.09);
          float streak = 0.5 + 0.5 * sin(vW.x * 3.1 + sin(vW.z * 2.3) * 2.0) * sin(vW.z * 2.7 + sin(vW.x * 1.7) * 2.0); float foam = smoothstep(0.6, 1.2, vH) * (0.45 + 0.55 * streak);
          col = mix(col, vec3(0.55, 0.62, 0.68) * (0.5 + uFlash), foam * 0.7);
          col += vec3(0.25, 0.3, 0.38) * uFlash * 0.4;
          float d = length(cameraPosition - vW); float f = 1.0 - exp(-pow(d * uFogD, 1.6));
          gl_FragColor = vec4(mix(col, uFog * (1.0 + uFlash * 3.0), f), 1.0); }`,
    });
    return { geo, mat };
  }, []);
  mat.uniforms.uT.value = t; mat.uniforms.uStorm.value = storm; mat.uniforms.uFlash.value = flash; mat.uniforms.uMoon.value = moon;
  mat.uniforms.uOff.value.set(center[0], center[1]);
  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
};

/** Lightning: deterministic flash envelopes at given times. */
export const flashAt = (t: number, times: number[]) => times.reduce((m, s) => {
  const u = t - s; if (u < 0 || u > 0.6) return m;
  const f = (u < 0.05 ? 1 : 0) + (u > 0.1 && u < 0.16 ? 0.8 : 0) + Math.exp(-u * 8) * 0.5;
  return Math.max(m, Math.min(1, f));
}, 0);

const Bolt: React.FC<{ seed: number; pos: V3; on: number }> = ({ seed, pos, on }) => {
  const obj = useMemo(() => {
    const pts: THREE.Vector3[] = []; let x = 0, y = 0;
    for (let i = 0; i < 26; i++) { pts.push(new THREE.Vector3(x, y, 0)); x += (hash(i, seed) - 0.5) * 3; y -= 1.4 + hash(i, seed + 1); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: "#e8eeff", toneMapped: false, fog: false }));
  }, [seed]);
  if (on < 0.5) return null;
  return <primitive object={obj} position={pos} />;
};

export const Sky: React.FC<{ flash: number; bolts: { seed: number; pos: V3; on: number }[]; clear?: number }> = ({ flash, bolts, clear = 0 }) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, "#05080c"); g.addColorStop(0.6, "#121a24"); g.addColorStop(1, "#1a2430");
    x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 260; i++) { const r = 30 + hash(i, 2) * 120; const gx = x.createRadialGradient(hash(i, 3) * 1024, hash(i, 4) * 360, 0, hash(i, 3) * 1024, hash(i, 4) * 360, r); gx.addColorStop(0, `rgba(${40 + hash(i, 5) * 40},${50 + hash(i, 5) * 40},${60 + hash(i, 5) * 45},0.35)`); gx.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gx; x.fillRect(0, 0, 1024, 512); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  return (
    <>
      <mesh scale={[-1, 1, 1]}><sphereGeometry args={[220, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.1]} /><meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} color={new THREE.Color(1 + flash * 2.5 + clear * 1.2, 1 + flash * 2.6 + clear * 1.3, 1 + flash * 3 + clear * 1.6)} /></mesh>
      {clear > 0 ? <Glow pos={[-20, 40, -120]} color="#f3e7c8" size={40 * clear} intensity={0.7 * clear} /> : null}
      {bolts.map((b, i) => <Bolt key={i} {...b} />)}
    </>
  );
};

// ------------------------------------------------------------------ robed figure
type Arms = { l?: V3; r?: V3 };
export const Robed: React.FC<{ pos: V3; rotY?: number; t: number; robe: string; mantle?: string; skin?: string; hair?: string; lean?: number; arms?: Arms; walk?: number; scale?: number; glow?: number; wind?: number }> = ({ pos, rotY = 0, t, robe, mantle, skin = "#a4785a", hair = "#2a1d14", lean = 0, arms = {}, walk = 0, scale = 1, glow = 0, wind = 1 }) => {
  const m = useMemo(() => ({
    robe: new THREE.MeshStandardMaterial({ color: robe, roughness: 0.95 }),
    mantle: new THREE.MeshStandardMaterial({ color: mantle ?? robe, roughness: 0.95, side: THREE.DoubleSide }),
    skin: new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 }),
    hair: new THREE.MeshStandardMaterial({ color: hair, roughness: 1 }),
  }), [robe, mantle, skin, hair]);
  const robeGeo = useMemo(() => {
    const prof = [[0.0, 0], [0.33, 0.02], [0.3, 0.3], [0.25, 0.7], [0.2, 1.05], [0.21, 1.28], [0.17, 1.42], [0.08, 1.5]].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(prof, 28);
  }, []);
  const sway = Math.sin(t * 2.3) * 0.04 * wind + Math.sin(t * 5.1) * 0.015 * wind;
  const bob = Math.abs(Math.sin(t * 3.2)) * 0.03 * walk;
  const sh = { l: [-0.21, 1.4, 0] as V3, r: [0.21, 1.4, 0] as V3 };
  const hand = { l: arms.l ?? [-0.27, 0.86, 0.05 + Math.sin(t * 3.2) * 0.12 * walk], r: arms.r ?? [0.27, 0.86, 0.05 - Math.sin(t * 3.2) * 0.12 * walk] };
  const elbow = (s: V3, h: V3, side: number): V3 => [(s[0] + h[0]) / 2 + side * 0.07, (s[1] + h[1]) / 2 - 0.04, (s[2] + h[2]) / 2 - 0.03];
  return (
    <group position={[pos[0], pos[1] + bob, pos[2]]} rotation={[0, rotY, 0]} scale={scale}>
      <group rotation={[lean, 0, sway]}>
        <mesh geometry={robeGeo} material={m.robe} />
        {/* mantle draped over one shoulder */}
        {mantle ? <mesh material={m.mantle} position={[0.04, 1.08, 0]} rotation={[0, 0, -0.35 + sway * 2]}><cylinderGeometry args={[0.215, 0.28, 0.75, 20, 1, true, 0.4, 3.6]} /></mesh> : null}
        {/* neck, head, hair, beard */}
        <Limb a={[0, 1.46, 0]} b={[0, 1.56, 0.01]} r={0.05} material={m.skin} />
        <mesh material={m.skin} position={[0, 1.67, 0.02]} scale={[0.9, 1.12, 0.95]}><sphereGeometry args={[0.105, 20, 16]} /></mesh>
        <mesh material={m.hair} position={[0, 1.7, -0.025]} scale={[0.97, 1.08, 0.95]}><sphereGeometry args={[0.112, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} /></mesh>
        <mesh material={m.hair} position={[0, 1.6, -0.06]} scale={[1.05, 1.6, 0.6]}><sphereGeometry args={[0.1, 14, 10]} /></mesh>
        <mesh material={m.hair} position={[0, 1.6, 0.075]} scale={[0.75, 0.9, 0.55]}><sphereGeometry args={[0.07, 14, 10]} /></mesh>
        {/* arms in sleeves, hands */}
        {(["l", "r"] as const).map((k, i) => {
          const s = sh[k], h = hand[k], e = elbow(s, h, i ? 1 : -1);
          return (
            <group key={k}>
              <Limb a={s} b={e} r={0.058} material={m.robe} />
              <Limb a={e} b={h} r={0.052} material={m.robe} />
              <mesh material={m.skin} position={h}><sphereGeometry args={[0.04, 12, 10]} /></mesh>
            </group>
          );
        })}
      </group>
      {glow > 0 ? (
        <>
          <pointLight position={[0, 1.5, 0.8]} intensity={4 * glow} distance={6} color="#fff3d6" />
          <Glow pos={[0, 1.1, 0]} color="#fff1d0" size={3.2} intensity={0.32 * glow} fog />
        </>
      ) : null}
    </group>
  );
};

// ------------------------------------------------------------------ the boat
export const Boat: React.FC<{ t: number; storm: number; pos: V3; rotY?: number; crew?: React.ReactNode }> = ({ t, storm, pos, rotY = 0, crew }) => {
  const m = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 256; const x = c.getContext("2d")!;
    for (let i = 0; i < 16; i++) { x.fillStyle = `hsl(28, ${35 + hash(i, 1) * 15}%, ${18 + hash(i, 2) * 10}%)`; x.fillRect(0, i * 16, 512, 15); x.fillStyle = "rgba(0,0,0,0.5)"; x.fillRect(0, i * 16 + 15, 512, 1); }
    for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(0,0,0,${hash(i, 3) * 0.15})`; x.fillRect(hash(i, 4) * 512, hash(i, 5) * 256, 30 + hash(i, 6) * 80, 1); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return { wood: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }), dark: new THREE.MeshStandardMaterial({ color: "#2a1a10", roughness: 0.9 }), sail: new THREE.MeshStandardMaterial({ color: "#8a7d68", roughness: 1 }) };
  }, []);
  const hull = useMemo(() => {
    // a half-cylinder trough, pinched at bow and stern
    const g = new THREE.CylinderGeometry(1.05, 1.05, 7.2, 24, 14, true, Math.PI / 2, Math.PI);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), k = Math.abs(y) / 3.6, pinch = 1 - Math.pow(k, 2.4) * 0.92;
      p.setX(i, p.getX(i) * pinch); p.setZ(i, p.getZ(i) * (0.62 + 0.38 * pinch));
      p.setY(i, y + 0); if (k > 0.85) p.setZ(i, p.getZ(i) - (k - 0.85) * 1.2);
    }
    g.computeVertexNormals(); g.rotateX(Math.PI / 2); g.rotateY(Math.PI / 2); return g;
  }, []);
  // ride the waves: sample under bow, stern, port and starboard
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const at = (lx: number, lz: number) => waveH(pos[0] + lx * c + lz * s, pos[2] - lx * s + lz * c, t, storm);
  const h0 = at(0, 0), hb = at(0, 3), hs = at(0, -3), hp = at(-1, 0), hr = at(1, 0);
  const pitch = Math.atan2(hs - hb, 6) * 0.9, roll = Math.atan2(hp - hr, 2) * 0.8;
  return (
    <group position={[pos[0], h0 * 0.85 + 0.15, pos[2]]} rotation={[0, rotY, 0]}>
      <group rotation={[pitch, 0, roll]}>
        <mesh geometry={hull} material={m.wood} position={[0, 0.55, 0]} />
        <mesh material={m.dark} position={[0, 0.55, 0]}><boxGeometry args={[1.9, 0.06, 0.12]} /></mesh>
        {[-1.6, 0, 1.6].map((z) => <mesh key={z} material={m.wood} position={[0, 0.35, z]}><boxGeometry args={[1.6, 0.06, 0.3]} /></mesh>)}
        <mesh material={m.dark} position={[0, 2.6, 0.9]}><cylinderGeometry args={[0.06, 0.08, 4.4, 10]} /></mesh>
        <mesh material={m.dark} position={[0, 4.2, 0.9]} rotation={[0, 0, Math.PI / 2 + 0.25]}><cylinderGeometry args={[0.04, 0.04, 3.4, 8]} /></mesh>
        <mesh material={m.sail} position={[0, 4.15, 0.9]} rotation={[0, 0, Math.PI / 2 + 0.25]}><cylinderGeometry args={[0.13, 0.13, 3.0, 10]} /></mesh>
        {[-1, 1].map((sd) => <mesh key={sd} material={m.dark} position={[sd * 1.1, 0.4, -1.2]} rotation={[0.2, 0, sd * 1.2]}><cylinderGeometry args={[0.03, 0.03, 3.2, 6]} /></mesh>)}
        <pointLight position={[0, 1.4, -2.2]} intensity={2.2} distance={5} color="#ffb060" />
        <Glow pos={[0, 1.4, -2.2]} color="#ffb060" size={0.7} intensity={0.8} />
        {crew}
      </group>
    </group>
  );
};

// ------------------------------------------------------------------ the shared world
export const World: React.FC<{ t: number; storm: number; flash: number; bolts: { seed: number; pos: V3; on: number }[]; clear?: number; rain?: number; camC: V3; children?: React.ReactNode }> = ({ t, storm, flash, bolts, clear = 0, rain = 1, camC, children }) => (
  <>
    <color attach="background" args={["#05080c"]} />
    <fogExp2 attach="fog" args={["#0b121a", 0.035]} />
    <ambientLight intensity={0.18 + flash * 1.6 + clear * 0.4} color="#7f93b5" />
    <directionalLight position={[-20, 40, -60]} intensity={0.35 + flash * 3 + clear * 0.9} color="#b9c8e6" />
    <Sky flash={flash} bolts={bolts} clear={clear} />
    <Ocean t={t} storm={storm} flash={flash} moon={0.25 + clear * 0.8} center={[camC[0], camC[2]]} />
    {rain > 0 ? <RainField t={t} center={[camC[0], camC[1], camC[2] - 4]} area={[14, 12, 14]} count={Math.round(1500 * rain)} color="#a7b6c8" speed={16} /> : null}
    {children}
  </>
);

export { Cam, clamp01, ease, lerp3, sm };
