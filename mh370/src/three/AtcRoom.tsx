import React, { useMemo } from "react";
import * as THREE from "three";
import { drawRadar, RadarState } from "../radarDisplay";
import { Glow } from "./Lights";

/** Radar display as a live canvas texture (redrawn every frame). */
export function useRadarTexture(state: RadarState, w = 1024, h = 1024) {
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { canvas, tex };
  }, [w, h]);
  drawRadar(canvas.getContext("2d")!, w, h, state);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Area-control room at night (generic): a row of consoles with large radar displays, a controller with a headset
 * in the foreground (from behind, over the shoulder), cool blue light. Metres; consoles face -Z (toward camera side +Z).
 */
export const AtcRoom: React.FC<{ t: number; radar: RadarState; talk?: number }> = ({ t, radar, talk = 0 }) => {
  const tex = useRadarTexture(radar);
  const side = useRadarTexture({ ...radar, view: { lon: 104.5, lat: 8.5, span: 7 }, target: "gone", trail: 0 }, 512, 512);
  const m = useMemo(() => ({
    floor: new THREE.MeshStandardMaterial({ color: "#0c0f13", roughness: 0.55, metalness: 0.2 }),
    wall: new THREE.MeshStandardMaterial({ color: "#10151b", roughness: 0.9 }),
    desk: new THREE.MeshStandardMaterial({ color: "#1d232a", roughness: 0.5, metalness: 0.3 }),
    bezel: new THREE.MeshStandardMaterial({ color: "#07090b", roughness: 0.4, metalness: 0.5 }),
    shirt: new THREE.MeshStandardMaterial({ color: "#2b3a4f", roughness: 0.9 }),
    hair: new THREE.MeshStandardMaterial({ color: "#0d0c0d", roughness: 0.8 }),
    skin: new THREE.MeshStandardMaterial({ color: "#6b4a37", roughness: 0.7 }),
    headset: new THREE.MeshStandardMaterial({ color: "#202226", roughness: 0.4, metalness: 0.5 }),
    chair: new THREE.MeshStandardMaterial({ color: "#121418", roughness: 0.8 }),
    key: new THREE.MeshStandardMaterial({ color: "#2a3038", roughness: 0.6 }),
    strip: new THREE.MeshBasicMaterial({ color: "#d8e2c4", toneMapped: false }),
  }), []);
  const lean = Math.sin(t * 0.5) * 0.02 + talk * 0.04;
  return (
    <group>
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[30, 30]} /></mesh>
      <mesh material={m.wall} position={[0, 3, -3.2]}><planeGeometry args={[30, 6]} /></mesh>
      {/* row of consoles receding to the right */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[i * 2.1, 0, -i * 0.25]}>
          <mesh material={m.desk} position={[0, 0.74, 0]}><boxGeometry args={[1.9, 0.06, 0.9]} /></mesh>
          <mesh material={m.desk} position={[0, 0.37, -0.35]}><boxGeometry args={[1.9, 0.74, 0.1]} /></mesh>
          <group position={[0, 1.32, -0.3]} rotation={[-0.08, 0, 0]}>
            <mesh material={m.bezel} position={[0, 0, -0.03]}><boxGeometry args={[1.12, 1.12, 0.05]} /></mesh>
            <mesh><planeGeometry args={[1.06, 1.06]} /><meshBasicMaterial map={i === 0 ? tex : side} toneMapped={false} color={i === 0 ? "#ffffff" : "#8a9298"} /></mesh>
          </group>
          {/* flight strips board + keyboard */}
          <mesh material={m.key} position={[0, 0.78, 0.15]} rotation={[-0.15, 0, 0]}><boxGeometry args={[0.5, 0.02, 0.18]} /></mesh>
          {[0, 1, 2, 3].map((j) => <mesh key={j} material={m.strip} position={[0.62, 0.775, -0.1 + j * 0.06]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.32, 0.045]} /></mesh>)}
          <pointLight position={[0, 1.3, 0.4]} intensity={0.8} distance={2.6} color="#7fb6ff" />
        </group>
      ))}
      {/* controller at the first console */}
      <group position={[-0.05, 0, 0.75]}>
        <mesh material={m.chair} position={[0, 0.85, 0.32]}><boxGeometry args={[0.5, 0.7, 0.08]} /></mesh>
        <group rotation={[lean, 0.05, 0]} position={[0, 0.5, 0]}>
          <mesh material={m.shirt} position={[0, 0.55, 0]} scale={[1, 1, 0.7]}><sphereGeometry args={[0.24, 24, 16]} /></mesh>
          {[-1, 1].map((s) => <mesh key={s} material={m.shirt} position={[s * 0.2, 0.68, 0]} scale={[1, 0.65, 0.85]}><sphereGeometry args={[0.1, 14, 10]} /></mesh>)}
          {/* arm reaching to the push-to-talk */}
          <mesh material={m.shirt} position={[0.24, 0.45, -0.22]} rotation={[1.1, 0, 0.2]}><capsuleGeometry args={[0.05, 0.3, 6, 10]} /></mesh>
          <group position={[0, 0.95, -0.02]}>
            <mesh material={m.skin} position={[0, -0.09, 0]}><cylinderGeometry args={[0.05, 0.055, 0.12, 12]} /></mesh>
            <mesh material={m.hair} scale={[0.9, 1.05, 1]}><sphereGeometry args={[0.105, 20, 16]} /></mesh>
            <mesh material={m.headset} position={[0, 0.02, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.112, 0.01, 8, 24, Math.PI]} /></mesh>
            {[-1, 1].map((s) => <mesh key={s} material={m.headset} position={[s * 0.105, -0.01, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.04, 0.03, 16]} /></mesh>)}
            <mesh material={m.headset} position={[-0.09, -0.07, -0.08]} rotation={[0.5, 0.6, 0]}><cylinderGeometry args={[0.006, 0.006, 0.16, 6]} /></mesh>
          </group>
        </group>
      </group>
      <ambientLight intensity={0.12} color="#4a6a90" />
      <Glow pos={[0, 1.32, -0.2]} color="#3f8fbf" size={2.2} intensity={0.18} />
      <Glow pos={[-1.6, 2.6, -2]} color="#ff3b30" size={0.3} intensity={0.8 * (Math.floor(t * 1.5) % 2)} />
    </group>
  );
};
