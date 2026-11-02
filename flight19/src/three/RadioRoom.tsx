import React, { useMemo } from "react";
import * as THREE from "three";
import { RadarScope, Blip } from "./Radar";
import { NOISE } from "./noise";

/** Wood-grain / painted-wall / dust textures, generated on canvas (deterministic). */
function useCanvasTex(kind: "wood" | "wall" | "floor" | "dirt", rep = 2) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d")!;
    let s = { wood: 11, wall: 23, floor: 37, dirt: 51 }[kind];
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    if (kind === "wood") {
      x.fillStyle = "#4a2f1c"; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 260; i++) { x.strokeStyle = `rgba(${30 + r() * 40},${18 + r() * 20},${8 + r() * 10},${0.25 + r() * 0.4})`; x.lineWidth = 1 + r() * 3; x.beginPath(); const y = r() * 512; x.moveTo(0, y); x.bezierCurveTo(170, y + (r() - 0.5) * 30, 340, y + (r() - 0.5) * 30, 512, y + (r() - 0.5) * 20); x.stroke(); }
    } else if (kind === "wall") {
      x.fillStyle = "#4b5a52"; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() * 0.04})`; x.fillRect(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 6); }
      x.fillStyle = "#2f3832"; x.fillRect(0, 430, 512, 82);
    } else if (kind === "floor") {
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const v = 40 + r() * 18; x.fillStyle = (i + j) % 2 ? `rgb(${v},${v - 4},${v - 8})` : `rgb(${v + 30},${v + 26},${v + 20})`; x.fillRect(i * 64, j * 64, 64, 64); }
    } else {
      x.clearRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(70,62,50,${r() * 0.25})`; const w = 1 + r() * 4; x.fillRect(r() * 512, r() * 512, w, w); }
      for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(40,34,26,${0.1 + r() * 0.25})`; x.beginPath(); x.arc(r() * 512, r() * 512, 10 + r() * 60, 0, 7); x.fill(); }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep, rep);
    return t;
  }, [kind, rep]);
}

const Window: React.FC<{ t: number; storm: number; flash: number; broken: boolean; moon: boolean }> = ({ t, storm, flash, broken, moon }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uFlash: { value: 0 }, uStorm: { value: 1 }, uBroken: { value: 0 }, uMoon: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `${NOISE}
          uniform float uT; uniform float uFlash; uniform float uStorm; uniform float uBroken; uniform float uMoon; varying vec2 vUv;
          void main(){
            vec2 p = vUv;
            vec3 sky = mix(vec3(0.12,0.15,0.2), vec3(0.03,0.04,0.06), p.y);
            float cl = fbm(vec3(p*vec2(3.0,2.0) + vec2(uT*0.02, 0.0), uT*0.05));
            sky = mix(sky, vec3(0.2,0.23,0.28), smoothstep(0.4,0.8,cl)*0.7);
            if (uMoon > 0.5) { sky = mix(vec3(0.05,0.07,0.11), vec3(0.01,0.015,0.03), p.y) + vec3(0.6,0.7,0.85)*exp(-length(p-vec2(0.7,0.75))*40.0); }
            sky += vec3(0.7,0.78,0.95) * uFlash * 1.2;
            // rain streaks on glass
            float rain = smoothstep(0.92, 1.0, fbm(vec3(p.x*60.0, p.y*4.0 + uT*6.0, 1.0))) * uStorm * (1.0 - uBroken);
            sky += vec3(0.5,0.55,0.6) * rain * 0.25;
            // venetian blinds
            float bl = step(0.62, fract(p.y*14.0)) * (1.0 - uBroken*step(0.5, p.x)*step(p.y, 0.6));
            vec3 c = mix(sky, vec3(0.05,0.05,0.045), bl*0.85);
            // cracks for the abandoned room
            float crack = uBroken * smoothstep(0.985, 1.0, fbm(vec3(p*18.0, 4.0)));
            c += vec3(0.4) * crack;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  mat.uniforms.uT.value = t; mat.uniforms.uFlash.value = flash; mat.uniforms.uStorm.value = storm; mat.uniforms.uBroken.value = broken ? 1 : 0; mat.uniforms.uMoon.value = moon ? 1 : 0;
  return (
    <mesh material={mat}>
      <planeGeometry args={[1.6, 1.1]} />
    </mesh>
  );
};

/** Floating dust motes lit by a light shaft (abandoned room). */
const Dust: React.FC<{ t: number }> = ({ t }) => {
  const { geo, base } = useMemo(() => {
    let s = 99;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const n = 700, base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) base.set([(r() - 0.5) * 3.5, r() * 2.6, (r() - 0.5) * 3], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    return { geo, base };
  }, []);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, base[i * 3] + Math.sin(t * 0.2 + i) * 0.08, base[i * 3 + 1] + Math.sin(t * 0.13 + i * 1.7) * 0.06, base[i * 3 + 2] + Math.cos(t * 0.17 + i) * 0.08);
  }
  pos.needsUpdate = true;
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.012} color="#c8c2b2" transparent opacity={0.55} depthWrite={false} />
    </points>
  );
};

/** A 1940s communications receiver: grey steel box, round dial, meter, knobs, glowing tuning window. */
const Receiver: React.FC<{ pos: [number, number, number]; glow: number; steel: THREE.Material; dark: THREE.Material; w?: number; flicker?: number }> = ({ pos, glow, steel, dark, w = 0.62, flicker = 1 }) => (
  <group position={pos}>
    <mesh material={steel}><boxGeometry args={[w, 0.3, 0.38]} /></mesh>
    <mesh position={[-w * 0.18, 0.02, 0.192]}><circleGeometry args={[0.085, 32]} /><meshStandardMaterial color="#d8c48f" emissive="#ffb347" emissiveIntensity={glow * flicker * 1.4} roughness={0.5} /></mesh>
    <mesh position={[w * 0.2, 0.05, 0.192]}><planeGeometry args={[0.14, 0.08]} /><meshStandardMaterial color="#e9e2c8" emissive="#ffcf7a" emissiveIntensity={glow * flicker * 0.9} /></mesh>
    {[-0.24, -0.08, 0.08, 0.24].map((x, i) => (
      <mesh key={i} material={dark} position={[x * w * 1.4, -0.1, 0.2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.025, 0.028, 0.03, 16]} /></mesh>
    ))}
  </group>
);

/**
 * Navy air station radio room, 1945 — or the same room abandoned decades later.
 * Camera-facing wall at z = -1.6; desk along it. Operator sits at the desk (1945 only).
 */
export const RadioRoom: React.FC<{ t: number; abandoned?: boolean; flash?: number; blips: Blip[]; scopePower?: number; scopeNoise?: number; radioGlow?: number; lampOn?: boolean; operatorTurn?: number }> = ({
  t, abandoned = false, flash = 0, blips, scopePower = 1, scopeNoise = 0.25, radioGlow = 1, lampOn = true, operatorTurn = 0,
}) => {
  const wood = useCanvasTex("wood", 1);
  const wall = useCanvasTex("wall", 1);
  const floor = useCanvasTex("floor", 3);
  const dirt = useCanvasTex("dirt", 1);
  const m = useMemo(() => {
    const wallM = new THREE.MeshStandardMaterial({ map: wall, roughness: 0.9, color: abandoned ? "#8a9088" : "#ffffff" });
    const woodM = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, color: abandoned ? "#8b8478" : "#ffffff" });
    const floorM = new THREE.MeshStandardMaterial({ map: floor, roughness: 0.8 });
    const steel = new THREE.MeshStandardMaterial({ color: abandoned ? "#51544f" : "#6d7470", roughness: abandoned ? 0.85 : 0.5, metalness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: "#121212", roughness: 0.4, metalness: 0.5 });
    const brass = new THREE.MeshStandardMaterial({ color: "#8a6a32", roughness: 0.35, metalness: 0.9 });
    const shirt = new THREE.MeshStandardMaterial({ color: "#7b6a4a", roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: "#1b140f", roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: "#8a6650", roughness: 0.7 });
    const dirtM = new THREE.MeshStandardMaterial({ map: dirt, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const paper = new THREE.MeshStandardMaterial({ color: abandoned ? "#8f8770" : "#ded6bd", roughness: 0.95, side: THREE.DoubleSide });
    return { wallM, woodM, floorM, steel, dark, brass, shirt, hair, skin, dirtM, paper };
  }, [wall, wood, floor, dirt, abandoned]);
  const lampFlicker = abandoned ? 0 : 0.92 + 0.08 * Math.sin(t * 23) * Math.sin(t * 7);
  return (
    <group>
      {/* room */}
      <mesh material={m.floorM} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}><planeGeometry args={[6, 5]} /></mesh>
      <mesh material={m.wallM} position={[0, 1.5, -1.6]}><planeGeometry args={[6, 3]} /></mesh>
      <mesh material={m.wallM} position={[-2.2, 1.5, 0.5]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[5, 3]} /></mesh>
      <mesh material={m.wallM} position={[2.6, 1.5, 0.5]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[5, 3]} /></mesh>
      <mesh material={m.wallM} position={[0, 3, 0.5]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[6, 5]} /></mesh>
      {/* window on the left wall */}
      <group position={[-2.18, 1.65, -0.2]} rotation={[0, Math.PI / 2, 0]}>
        <Window t={t} storm={abandoned ? 0 : 1} flash={flash} broken={abandoned} moon={abandoned} />
        <mesh material={m.woodM} position={[0, -0.6, 0.06]}><boxGeometry args={[1.75, 0.08, 0.16]} /></mesh>
      </group>
      {/* desk */}
      <group position={[0, 0, -1.15]}>
        <mesh material={m.woodM} position={[0, 0.76, 0]}><boxGeometry args={[3.6, 0.06, 0.85]} /></mesh>
        <mesh material={m.woodM} position={[-1.5, 0.38, 0]}><boxGeometry args={[0.55, 0.76, 0.8]} /></mesh>
        <mesh material={m.woodM} position={[1.5, 0.38, 0]}><boxGeometry args={[0.55, 0.76, 0.8]} /></mesh>
        {abandoned ? <mesh material={m.dirtM} position={[0, 0.795, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[3.6, 0.85]} /></mesh> : null}
        {/* radio stack */}
        <Receiver pos={[-1.05, 0.95, -0.15]} glow={radioGlow} steel={m.steel} dark={m.dark} flicker={abandoned ? 0.5 + 0.5 * Math.abs(Math.sin(t * 13)) : 1} />
        <Receiver pos={[-1.05, 1.27, -0.15]} glow={radioGlow * 0.8} steel={m.steel} dark={m.dark} flicker={abandoned ? Math.abs(Math.sin(t * 7.3)) : 1} />
        <Receiver pos={[1.05, 0.95, -0.15]} glow={radioGlow * 0.9} steel={m.steel} dark={m.dark} w={0.7} flicker={abandoned ? 0.4 + 0.6 * Math.abs(Math.sin(t * 9.1)) : 1} />
        {/* radar console with round scope in the middle */}
        <group position={[0, 1.15, -0.2]}>
          <mesh material={m.steel}><boxGeometry args={[0.95, 0.75, 0.4]} /></mesh>
          <mesh material={m.dark} position={[0, 0.03, 0.2]}><circleGeometry args={[0.36, 48]} /></mesh>
          <group position={[0, 0.03, 0.205]}><RadarScope t={t} blips={blips} radius={0.31} power={scopePower} noise={scopeNoise} /></group>
          <mesh material={m.brass} position={[0, 0.03, 0.21]}><torusGeometry args={[0.325, 0.018, 10, 48]} /></mesh>
        </group>
        {/* microphone */}
        <group position={[0.55, 0.79, 0.15]}>
          <mesh material={m.dark}><cylinderGeometry args={[0.07, 0.09, 0.03, 24]} /></mesh>
          <mesh material={m.steel} position={[0, 0.14, 0]}><cylinderGeometry args={[0.01, 0.01, 0.26, 8]} /></mesh>
          <mesh material={m.brass} position={[0, 0.3, 0.02]} rotation={[0.3, 0, 0]} scale={[1, 1.25, 0.6]}><sphereGeometry args={[0.055, 20, 14]} /></mesh>
        </group>
        {/* papers / log book */}
        <mesh material={m.paper} position={[0.15, 0.8, 0.25]} rotation={[-Math.PI / 2, 0, 0.2]}><planeGeometry args={[0.3, 0.4]} /></mesh>
        {/* desk lamp */}
        <group position={[1.45, 0.79, 0.15]}>
          <mesh material={m.brass}><cylinderGeometry args={[0.08, 0.09, 0.03, 20]} /></mesh>
          <mesh material={m.brass} position={[0, 0.2, 0]}><cylinderGeometry args={[0.012, 0.012, 0.4, 8]} /></mesh>
          <mesh position={[0, 0.42, 0.04]} rotation={[0.5, 0, 0]}><coneGeometry args={[0.11, 0.12, 20, 1, true]} /><meshStandardMaterial color="#1f4d2e" side={THREE.DoubleSide} roughness={0.4} metalness={0.4} /></mesh>
          {lampOn ? <pointLight position={[0, 0.36, 0.08]} intensity={2.2 * lampFlicker} distance={4} decay={1.6} color="#ffcf8a" /> : null}
        </group>
      </group>
      {/* operator (1945): seated, headphones, khaki shirt — seen from behind */}
      {!abandoned ? (
        <group position={[0.15, 0, -0.35]} rotation={[0, operatorTurn, 0]}>
          <mesh material={m.dark} position={[0, 0.48, 0.05]}><boxGeometry args={[0.45, 0.06, 0.45]} /></mesh>
          <mesh material={m.shirt} position={[0, 0.85, 0]} scale={[1, 1.1, 0.7]}><capsuleGeometry args={[0.2, 0.32, 8, 16]} /></mesh>
          <mesh material={m.skin} position={[0, 1.27, 0.0]}><sphereGeometry args={[0.105, 24, 18]} /></mesh>
          <mesh material={m.hair} position={[0, 1.31, 0.02]} scale={[1.02, 0.85, 1.04]}><sphereGeometry args={[0.105, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.6]} /></mesh>
          <mesh material={m.dark} position={[0, 1.3, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.12, 0.012, 8, 24, Math.PI]} /></mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={m.dark} position={[0.115 * s, 1.26, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.03, 16]} /></mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={s} material={m.shirt} position={[0.24 * s, 0.82, -0.2]} rotation={[1.1, 0, 0.15 * s]}><capsuleGeometry args={[0.055, 0.3, 6, 12]} /></mesh>
          ))}
        </group>
      ) : (
        <>
          {/* abandoned: overturned chair, scattered papers, dust in the moonlight */}
          <group position={[0.4, 0.22, -0.2]} rotation={[0.2, 0.7, 1.4]}>
            <mesh material={m.dark}><boxGeometry args={[0.45, 0.06, 0.45]} /></mesh>
            <mesh material={m.dark} position={[0, 0.3, -0.2]}><boxGeometry args={[0.45, 0.5, 0.05]} /></mesh>
          </group>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} material={m.paper} position={[-0.8 + i * 0.45, 0.005 + i * 0.001, 0.3 + (i % 2) * 0.4]} rotation={[-Math.PI / 2, 0, i * 0.9]}><planeGeometry args={[0.25, 0.33]} /></mesh>
          ))}
          <mesh material={m.dirtM} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><planeGeometry args={[6, 5]} /></mesh>
          <Dust t={t} />
        </>
      )}
    </group>
  );
};
