import React, { useMemo } from "react";
import * as THREE from "three";

function useRunwayTex() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 2048;
    const x = c.getContext("2d")!;
    x.fillStyle = "#6c6a64"; x.fillRect(0, 0, 256, 2048);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9000; i++) { const v = 80 + r() * 60; x.fillStyle = `rgba(${v},${v},${v - 6},0.18)`; x.fillRect(r() * 256, r() * 2048, 2, 2); }
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(30,30,28,${0.1 + r() * 0.2})`; x.fillRect(80 + r() * 96, r() * 2048, 3 + r() * 10, 30 + r() * 120); }
    x.fillStyle = "#d8d4c6";
    for (let y = 40; y < 2048; y += 120) x.fillRect(124, y, 8, 60);              // centreline dashes
    for (let i = 0; i < 8; i++) x.fillRect(20 + i * 28, 1900, 14, 120);          // threshold bars
    x.fillStyle = "#3d3b37";
    for (let y = 0; y < 2048; y += 64) x.fillRect(0, y, 256, 2);                // concrete slab joints
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
}

const Palm: React.FC<{ pos: [number, number, number]; h: number; mat: THREE.Material; leaf: THREE.Material; lean: number }> = ({ pos, h, mat, leaf, lean }) => (
  <group position={pos} rotation={[0, 0, lean]}>
    <mesh material={mat} position={[0, h / 2, 0]}><cylinderGeometry args={[0.18, 0.3, h, 8]} /></mesh>
    {Array.from({ length: 9 }, (_, i) => (
      <group key={i} position={[0, h, 0]} rotation={[0, (i / 9) * Math.PI * 2, 0.9 + (i % 3) * 0.15]}>
        <mesh material={leaf} position={[0, 1.6, 0]} scale={[0.35, 1, 0.06]}><sphereGeometry args={[1.7, 8, 6]} /></mesh>
      </group>
    ))}
  </group>
);

/** NAS Fort Lauderdale, 1945: runway along +X, grass, hangars, control tower, palms, the sea beyond. */
export const Airfield: React.FC<{ env?: THREE.Texture | null }> = ({ env = null }) => {
  const runway = useRunwayTex();
  const m = useMemo(() => ({
    runway: new THREE.MeshStandardMaterial({ map: runway, roughness: 0.92 }),
    grass: new THREE.MeshStandardMaterial({ color: "#4f5a3c", roughness: 1 }),
    hangar: new THREE.MeshStandardMaterial({ color: "#8d8f89", roughness: 0.7, metalness: 0.4, envMap: env, envMapIntensity: 0.4 }),
    roof: new THREE.MeshStandardMaterial({ color: "#5c605e", roughness: 0.6, metalness: 0.5, envMap: env, envMapIntensity: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: "#1d1f22", roughness: 0.8 }),
    tower: new THREE.MeshStandardMaterial({ color: "#c8c3b4", roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: "#2b3540", roughness: 0.1, metalness: 0.6, envMap: env }),
    trunk: new THREE.MeshStandardMaterial({ color: "#5a4a38", roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#3d5132", roughness: 0.9, side: THREE.DoubleSide }),
  }), [runway, env]);
  const palms = useMemo(() => {
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 34 }, () => ({ x: -420 + r() * 840, z: (r() < 0.5 ? -1 : 1) * (70 + r() * 90), h: 7 + r() * 5, lean: (r() - 0.5) * 0.25 }));
  }, []);
  return (
    <group>
      <mesh material={m.grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}><planeGeometry args={[3000, 3000]} /></mesh>
      <mesh material={m.runway} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} position={[0, 0, 0]}><planeGeometry args={[46, 1500]} /></mesh>
      {/* hangars (arched roofs) */}
      {[-260, -150, -40].map((x, i) => (
        <group key={i} position={[x, 0, -150]}>
          <mesh material={m.hangar} position={[0, 7, 0]}><boxGeometry args={[70, 14, 50]} /></mesh>
          <mesh material={m.roof} position={[0, 14, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1]}><cylinderGeometry args={[25, 25, 70, 24, 1, false, 0, Math.PI]} /></mesh>
          <mesh material={m.dark} position={[0, 6, 25.1]}><planeGeometry args={[52, 12]} /></mesh>
        </group>
      ))}
      {/* control tower */}
      <group position={[90, 0, -120]}>
        <mesh material={m.tower} position={[0, 10, 0]}><boxGeometry args={[9, 20, 9]} /></mesh>
        <mesh material={m.glass} position={[0, 22.5, 0]}><boxGeometry args={[11, 5, 11]} /></mesh>
        <mesh material={m.tower} position={[0, 25.3, 0]}><boxGeometry args={[12.5, 0.6, 12.5]} /></mesh>
        <mesh material={m.dark} position={[0, 30, 0]}><cylinderGeometry args={[0.15, 0.15, 9, 6]} /></mesh>
      </group>
      {palms.map((p, i) => <Palm key={i} pos={[p.x, 0, p.z]} h={p.h} mat={m.trunk} leaf={m.leaf} lean={p.lean} />)}
    </group>
  );
};
