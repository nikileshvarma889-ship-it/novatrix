import React, { useMemo } from "react";
import * as THREE from "three";
import { drawOcean, OceanState } from "../oceanDisplay";
import { Glow } from "./Lights";

/** Radar display as a live canvas texture (redrawn every frame). */
export function useRadarTexture(state: OceanState, w = 1024, h = 1024) {
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { canvas, tex };
  }, [w, h]);
  drawOcean(canvas.getContext("2d")!, w, h, state);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Area-control room at night (generic): a row of consoles with large radar displays, a controller with a headset
 * in the foreground (from behind, over the shoulder), cool blue light. Metres; consoles face -Z (toward camera side +Z).
 */
/** Radio receiver panel (fictional): frequency readout and a receive lamp that lights while a station transmits. */
const RadioPanel: React.FC<{ rx: number; t: number }> = ({ rx, t }) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 512; c.height = 160;
    const x = c.getContext("2d")!;
    x.fillStyle = "#050607"; x.fillRect(0, 0, 512, 160);
    x.font = "bold 92px 'Liberation Mono', monospace"; x.fillStyle = "#ff9a3c"; x.textBaseline = "middle"; x.fillText("121.500", 40, 84);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  const flick = rx > 0 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 37) * Math.sin(t * 11.3)) : 0;
  return (
    <group position={[-0.62, 0.86, -0.12]} rotation={[-0.5, 0.35, 0]}>
      <mesh><boxGeometry args={[0.42, 0.16, 0.12]} /><meshStandardMaterial color="#1b1f24" roughness={0.5} metalness={0.4} /></mesh>
      <mesh position={[-0.04, 0.01, 0.061]}><planeGeometry args={[0.24, 0.075]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      <mesh position={[0.15, 0.01, 0.061]}><circleGeometry args={[0.012, 16]} /><meshBasicMaterial color={rx > 0 ? "#ff3020" : "#3a0d0a"} toneMapped={false} /></mesh>
      {[0, 1, 2].map((i) => <mesh key={i} position={[0.12 + i * 0.03, -0.045, 0.065]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.009, 0.009, 0.015, 10]} /><meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} /></mesh>)}
      <Glow pos={[0.15, 0.01, 0.07]} color="#ff2a10" size={0.12 * (1 + flick)} intensity={rx * flick} />
      <Glow pos={[-0.04, 0.01, 0.07]} color="#ff9a3c" size={0.35} intensity={0.25} />
    </group>
  );
};

/** A capsule limb between two points. */
const Limb: React.FC<{ a: [number, number, number]; b: [number, number, number]; r: number; material: THREE.Material }> = ({ a, b, r, material }) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const mid = A.clone().add(B).multiplyScalar(0.5), dir = B.clone().sub(A);
  const len = Math.max(0.01, dir.length() - 2 * r);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return <mesh material={material} position={mid} quaternion={q}><capsuleGeometry args={[r, len, 6, 10]} /></mesh>;
};
const L3 = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k) as [number, number, number];
const sm = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };

export type RoomFx = { talk?: number; rx?: number; flicker?: number; freeze?: number; mic?: number; headsetOff?: number; screensOff?: number; dim?: number; look?: number };

export const AtcRoom: React.FC<{ t: number; radar: OceanState } & RoomFx> = ({ t, radar, talk = 0, rx = 0, flicker = 0, freeze = 0, mic = 0, headsetOff = 0, screensOff = 0, dim = 0, look = 0 }) => {
  const tex = useRadarTexture(radar);
  const side = useRadarTexture({ ...radar, view: { lon: 104.5, lat: 6, span: 14 }, ghost: 0, ghostLabel: 0, track: [], arc: 0, area: 0, unknown: 0 }, 512, 512);
  const m = useMemo(() => ({
    floor: new THREE.MeshStandardMaterial({ color: "#0c0f13", roughness: 0.35, metalness: 0.3 }),
    wall: new THREE.MeshStandardMaterial({ color: "#10151b", roughness: 0.9 }),
    desk: new THREE.MeshStandardMaterial({ color: "#1d232a", roughness: 0.45, metalness: 0.35 }),
    bezel: new THREE.MeshStandardMaterial({ color: "#07090b", roughness: 0.4, metalness: 0.5 }),
    shirt: new THREE.MeshStandardMaterial({ color: "#2b3a4f", roughness: 0.9 }),
    hair: new THREE.MeshStandardMaterial({ color: "#0d0c0d", roughness: 0.8 }),
    skin: new THREE.MeshStandardMaterial({ color: "#7a5440", roughness: 0.6 }),
    headset: new THREE.MeshStandardMaterial({ color: "#202226", roughness: 0.4, metalness: 0.5 }),
    chair: new THREE.MeshStandardMaterial({ color: "#121418", roughness: 0.8 }),
    key: new THREE.MeshStandardMaterial({ color: "#2a3038", roughness: 0.6 }),
    mic: new THREE.MeshStandardMaterial({ color: "#16181b", roughness: 0.35, metalness: 0.7 }),
    strip: new THREE.MeshBasicMaterial({ color: "#d8e2c4", toneMapped: false }),
  }), []);
  const on = 1 - screensOff;
  const lean = (Math.sin(t * 0.5) * 0.02) * (1 - freeze) + talk * 0.03 - freeze * 0.05 + headsetOff * 0.08;
  // right hand: push-to-talk on the desk -> handheld mic at the mouth
  const kM = sm(mic);
  const rHand = L3([0.26, 0.3, -0.38], [0.07, 0.86, -0.17], kM);
  // left hand: resting -> lifting the headset off
  const kH = sm(headsetOff);
  const hsOff: [number, number, number] = [-0.05 * kH, 0.16 * kH, -0.1 * kH];
  const lHand = L3([-0.24, 0.32, -0.34], [-0.13, 0.98, -0.1], sm(headsetOff * 1.4));
  const headTurn = look * 0.35;
  return (
    <group>
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[30, 30]} /></mesh>
      <mesh material={m.wall} position={[0, 3, -3.2]}><planeGeometry args={[30, 6]} /></mesh>
      {[0, 1, 2, 3].map((i) => {
        const fl = 1 - flicker * (0.5 + 0.5 * Math.sin(t * 53 + i * 2.1) * Math.sin(t * 17.7 + i));
        const sOff = Math.max(0, Math.min(1, screensOff * 1.6 - i * 0.18));     // screens die one after another
        const b = fl * (1 - sOff);
        return (
          <group key={i} position={[i * 2.1, 0, -i * 0.25]}>
            <mesh material={m.desk} position={[0, 0.74, 0]}><boxGeometry args={[1.9, 0.06, 0.9]} /></mesh>
            <mesh material={m.desk} position={[0, 0.37, -0.35]}><boxGeometry args={[1.9, 0.74, 0.1]} /></mesh>
            <group position={[0, 1.32, -0.3]} rotation={[-0.08, 0, 0]}>
              <mesh material={m.bezel} position={[0, 0, -0.03]}><boxGeometry args={[1.12, 1.12, 0.05]} /></mesh>
              <mesh><planeGeometry args={[1.06, 1.06]} /><meshBasicMaterial map={i === 0 ? tex : side} toneMapped={false} color={new THREE.Color(i === 0 ? "#ffffff" : "#8a9298").multiplyScalar(Math.max(0.02, b))} /></mesh>
            </group>
            <mesh material={m.key} position={[0, 0.78, 0.15]} rotation={[-0.15, 0, 0]}><boxGeometry args={[0.5, 0.02, 0.18]} /></mesh>
            {[0, 1, 2, 3].map((j) => <mesh key={j} material={m.strip} position={[0.62, 0.775, -0.1 + j * 0.06]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.32, 0.045]} /></mesh>)}
            <pointLight position={[0, 1.3, 0.4]} intensity={0.8 * b + 0.02} distance={2.6} color="#7fb6ff" />
          </group>
        );
      })}
      {/* the controller at the first console */}
      <group position={[-0.05, 0, 0.75]}>
        <mesh material={m.chair} position={[0, 0.85, 0.32]}><boxGeometry args={[0.5, 0.7, 0.08]} /></mesh>
        <group rotation={[lean, 0.05, 0]} position={[0, 0.5, 0]}>
          <mesh material={m.shirt} position={[0, 0.55, 0]} scale={[1, 1, 0.7]}><sphereGeometry args={[0.24, 24, 16]} /></mesh>
          {[-1, 1].map((s) => <mesh key={s} material={m.shirt} position={[s * 0.2, 0.68, 0]} scale={[1, 0.65, 0.85]}><sphereGeometry args={[0.1, 14, 10]} /></mesh>)}
          <Limb a={[0.2, 0.66, 0]} b={rHand} r={0.05} material={m.shirt} />
          <mesh material={m.skin} position={rHand}><sphereGeometry args={[0.04, 12, 10]} /></mesh>
          {kM > 0.02 ? (
            <group position={rHand} rotation={[-0.9, 0.3 * kM, 0.4]}>
              <mesh material={m.mic} position={[0, 0.05, 0]}><cylinderGeometry args={[0.016, 0.02, 0.14, 12]} /></mesh>
              <mesh material={m.mic} position={[0, 0.13, 0]}><sphereGeometry args={[0.028, 14, 10]} /></mesh>
            </group>
          ) : null}
          <Limb a={[-0.2, 0.66, 0]} b={lHand} r={0.05} material={m.shirt} />
          <mesh material={m.skin} position={lHand}><sphereGeometry args={[0.04, 12, 10]} /></mesh>
          {/* head: face (skin) in front, hair behind, nose and chin for a readable profile */}
          <group position={[0, 0.95, -0.02]} rotation={[0.08 * freeze, headTurn, 0]}>
            <mesh material={m.skin} position={[0, -0.09, 0]}><cylinderGeometry args={[0.05, 0.055, 0.12, 12]} /></mesh>
            <mesh material={m.skin} position={[0, -0.01, -0.02]} scale={[0.86, 1.0, 0.92]}><sphereGeometry args={[0.1, 24, 18]} /></mesh>
            <mesh material={m.hair} position={[0, 0.025, 0.018]} scale={[0.92, 0.98, 0.94]}><sphereGeometry args={[0.105, 24, 18]} /></mesh>
            <mesh material={m.skin} position={[0, -0.015, -0.112]} rotation={[-Math.PI / 2 - 0.25, 0, 0]}><coneGeometry args={[0.017, 0.045, 10]} /></mesh>
            <mesh material={m.skin} position={[0, -0.075, -0.07]} scale={[0.75, 0.55, 0.7]}><sphereGeometry args={[0.07, 16, 12]} /></mesh>
            {[-1, 1].map((s) => <mesh key={s} material={m.skin} position={[s * 0.088, -0.005, 0.005]} scale={[0.4, 1, 0.7]}><sphereGeometry args={[0.03, 10, 8]} /></mesh>)}
            <group position={hsOff} rotation={[-0.5 * kH, 0, 0.3 * kH]}>
              <mesh material={m.headset} position={[0, 0.02, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.112, 0.01, 8, 24, Math.PI]} /></mesh>
              {[-1, 1].map((s) => <mesh key={s} material={m.headset} position={[s * 0.105, -0.01, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.04, 0.04, 0.03, 16]} /></mesh>)}
              <mesh material={m.headset} position={[-0.09, -0.07, -0.08]} rotation={[0.5, 0.6, 0]}><cylinderGeometry args={[0.006, 0.006, 0.16, 6]} /></mesh>
            </group>
          </group>
        </group>
      </group>
      <RadioPanel rx={rx} t={t} />
      {/* second controller at the next console, turned toward the voice */}
      <group position={[2.1, 0, 0.55]} rotation={[0, 0.5 * freeze, 0]}>
        <mesh material={m.chair} position={[0, 0.85, 0.32]}><boxGeometry args={[0.5, 0.7, 0.08]} /></mesh>
        <mesh material={m.shirt} position={[0, 1.05, 0]} scale={[1, 1, 0.7]}><sphereGeometry args={[0.24, 24, 16]} /></mesh>
        <mesh material={m.skin} position={[0, 1.36, 0]}><cylinderGeometry args={[0.05, 0.055, 0.12, 12]} /></mesh>
        <mesh material={m.skin} position={[0, 1.44, -0.02]} scale={[0.86, 1.0, 0.92]}><sphereGeometry args={[0.1, 20, 16]} /></mesh>
        <mesh material={m.hair} position={[0, 1.47, 0.0]} scale={[0.92, 0.98, 0.94]}><sphereGeometry args={[0.105, 20, 16]} /></mesh>
      </group>
      <ambientLight intensity={(0.12 * (1 - flicker * 0.5)) * (1 - dim * 0.85)} color="#4a6a90" />
      {/* after the blackout: red emergency lamp and a faint cool spill from the corridor */}
      <pointLight position={[-1.8, 2.3, -1.5]} intensity={dim * 7} distance={7} color="#ff3a2a" />
      <pointLight position={[-1.2, 2.2, 2.4]} intensity={dim * 3} distance={6} color="#6d8fbf" />
      <Glow pos={[-1.8, 2.3, -1.6]} color="#ff2a1a" size={0.5} intensity={dim * 0.8} />
      <Glow pos={[0, 1.32, -0.2]} color="#3f8fbf" size={2.2} intensity={0.18 * on} />
      <Glow pos={[-1.6, 2.6, -2]} color="#ff3b30" size={0.3} intensity={0.8 * (Math.floor(t * 1.5) % 2) * (1 - dim * 0.6)} />
    </group>
  );
};
