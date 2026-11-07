import React, { useMemo } from "react";
import * as THREE from "three";
import { LightField } from "./Lights";

/** Wet night runway texture: dark asphalt, rubber marks, worn white centreline/threshold markings. */
function useRunwayTex() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 4096;
    const x = c.getContext("2d")!;
    x.fillStyle = "#2a2c2f"; x.fillRect(0, 0, 256, 4096);
    let s = 11;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16000; i++) { const v = 30 + r() * 40; x.fillStyle = `rgba(${v},${v},${v + 2},0.25)`; x.fillRect(r() * 256, r() * 4096, 2, 2); }
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(8,8,9,${0.15 + r() * 0.25})`; x.fillRect(90 + r() * 76, r() * 4096, 4 + r() * 12, 60 + r() * 220); }
    x.fillStyle = "#a9aaa6";
    for (let y = 60; y < 4096; y += 110) x.fillRect(125, y, 6, 55);
    for (let i = 0; i < 8; i++) { x.fillRect(16 + i * 14, 3900, 9, 150); x.fillRect(240 - 16 - 9 - i * 14, 3900, 9, 150); }
    x.fillRect(4, 0, 3, 4096); x.fillRect(249, 0, 3, 4096);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
}

/** Lit terminal / hangar façade texture (rows of warm and cool windows). */
function useFacadeTex(seed: number, cols = 64, rows = 6) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 128;
    const x = c.getContext("2d")!;
    x.fillStyle = "#07090c"; x.fillRect(0, 0, 1024, 128);
    let s = seed;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        if (r() < 0.25) continue;
        const warm = r() < 0.6;
        const v = 0.45 + r() * 0.55;
        x.fillStyle = warm ? `rgba(255,${190 + 40 * v},${120 + 50 * v},${v})` : `rgba(${170 + 50 * v},${210 + 30 * v},255,${v})`;
        x.fillRect(4 + i * (1016 / cols), 8 + j * (112 / rows), 1016 / cols - 5, 112 / rows - 7);
      }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [seed, cols, rows]);
}

/** Night airport (KLIA-like layout, generic): runway along +X centred at origin, 60 m wide, 4 km long. */
export const Airport: React.FC<{ t: number; env?: THREE.Texture | null; lights?: number; fog?: number; city?: boolean }> = ({ t, env = null, lights = 1, fog = 0, city = true }) => {
  const runway = useRunwayTex();
  const fac1 = useFacadeTex(5, 90, 5);
  const fac2 = useFacadeTex(9, 40, 3);
  const m = useMemo(() => ({
    runway: new THREE.MeshStandardMaterial({ map: runway, roughness: 0.38, metalness: 0.1, envMap: env, envMapIntensity: 0.5 }),
    grass: new THREE.MeshStandardMaterial({ color: "#0f1411", roughness: 1 }),
    taxi: new THREE.MeshStandardMaterial({ color: "#1d1f22", roughness: 0.6 }),
    term: new THREE.MeshBasicMaterial({ map: fac1, toneMapped: false }),
    hangar: new THREE.MeshBasicMaterial({ map: fac2, toneMapped: false }),
    roof: new THREE.MeshStandardMaterial({ color: "#16191d", roughness: 0.6, metalness: 0.4 }),
    tower: new THREE.MeshStandardMaterial({ color: "#2b2f35", roughness: 0.7 }),
    cab: new THREE.MeshBasicMaterial({ color: "#7fb4c9", toneMapped: false }),
  }), [runway, env, fac1, fac2]);
  const L = useMemo(() => {
    const edge: [number, number, number][] = [], centre: [number, number, number][] = [], centreRed: [number, number, number][] = [];
    const thr: [number, number, number][] = [], end: [number, number, number][] = [], blue: [number, number, number][] = [], approach: [number, number, number][] = [];
    for (let x = -2000; x <= 2000; x += 60) { edge.push([x, 0.5, -31]); edge.push([x, 0.5, 31]); }
    for (let x = -2000; x <= 2000; x += 15) (x > 1100 && Math.floor(x / 15) % 2 === 0 ? centreRed : centre).push([x, 0.15, 0]);
    for (let z = -30; z <= 30; z += 3) { thr.push([-2003, 0.3, z]); end.push([2003, 0.3, z]); }
    for (let x = -2000; x <= 2000; x += 45) blue.push([x, 0.4, -152], [x, 0.4, -128]);
    for (let x = -2060; x >= -2900; x -= 60) for (let z = -6; z <= 6; z += 3) approach.push([x, 1.2, z]);
    // distant city haze lights
    const city: [number, number, number][] = [];
    let s = 21;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) { const a = -0.5 + r() * 3.6, d = 3500 + r() * 2500; city.push([Math.cos(a) * d, 2 + r() * 20, -Math.abs(Math.sin(a) * d) - 600]); }
    return { edge, centre, centreRed, thr, end, blue, approach, city };
  }, []);
  // sequenced approach strobe ("rabbit") running toward the threshold
  const rabbit = Math.floor((t * 2 % 1) * 14);
  return (
    <group>
      <mesh material={m.grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}><planeGeometry args={[12000, 12000]} /></mesh>
      <mesh material={m.runway} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} position={[0, 0, 0]}><planeGeometry args={[60, 4000]} /></mesh>
      <mesh material={m.taxi} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -140]}><planeGeometry args={[4000, 23]} /></mesh>
      {/* terminal + hangars far side */}
      <group position={[300, 0, -620]}>
        <mesh material={m.term} position={[0, 14, 0]}><boxGeometry args={[1300, 28, 120]} /></mesh>
        <mesh material={m.roof} position={[0, 30, 0]} scale={[1, 0.08, 1]}><boxGeometry args={[1340, 40, 140]} /></mesh>
      </group>
      {[-900, -620].map((x, i) => (
        <mesh key={i} material={m.hangar} position={[x, 16, -420]}><boxGeometry args={[220, 32, 90]} /></mesh>
      ))}
      <group position={[-200, 0, -520]}>
        <mesh material={m.tower} position={[0, 60, 0]}><cylinderGeometry args={[6, 9, 120, 16]} /></mesh>
        <mesh material={m.cab} position={[0, 124, 0]}><cylinderGeometry args={[13, 10, 8, 16]} /></mesh>
        <mesh material={m.tower} position={[0, 130, 0]}><cylinderGeometry args={[14, 14, 3, 16]} /></mesh>
      </group>
      <LightField points={L.edge} color="#fff2d6" size={1.6} minPx={4} intensity={1 * lights} fog={fog} />
      <LightField points={L.centre} color="#e8f0ff" size={0.9} minPx={3} intensity={0.85 * lights} fog={fog} />
      <LightField points={L.centreRed} color="#ff4a3a" size={0.9} minPx={3} intensity={0.85 * lights} fog={fog} />
      <LightField points={L.thr} color="#3cff7a" size={1.4} minPx={4} intensity={1 * lights} fog={fog} />
      <LightField points={L.end} color="#ff3324" size={1.4} minPx={4} intensity={1 * lights} fog={fog} />
      <LightField points={L.blue} color="#4f7dff" size={1.2} minPx={3} intensity={0.9 * lights} fog={fog} />
      <LightField points={L.approach} color="#fff3dc" size={1.8} minPx={4} intensity={1 * lights} fog={fog} />
      <LightField points={L.approach.filter((_, i) => Math.floor(i / 5) === 13 - rabbit)} color="#ffffff" size={6} minPx={10} intensity={lights} fog={fog} />
      {city ? <LightField points={L.city} color="#ffb871" size={6} minPx={2} intensity={0.55} twinkle={0.6} t={t} fog={fog * 0.3} /> : null}
    </group>
  );
};
