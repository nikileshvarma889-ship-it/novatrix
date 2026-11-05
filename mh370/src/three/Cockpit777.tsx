import React, { useMemo } from "react";
import * as THREE from "three";
import { Glow } from "./Lights";

type Kind = "pfd" | "nd" | "eicas" | "mfd";

/** Glass-cockpit display faces (generic, stylised): attitude + tapes, map with magenta route, engine gauges. */
function useDisplay(kind: Kind, side: number) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 512;
    const x = c.getContext("2d")!;
    x.fillStyle = "#020304"; x.fillRect(0, 0, 512, 512);
    x.lineWidth = 3; x.font = "bold 22px 'Liberation Mono', monospace"; x.textAlign = "center"; x.textBaseline = "middle";
    if (kind === "pfd") {
      x.save(); x.beginPath(); x.rect(120, 90, 272, 300); x.clip();
      x.fillStyle = "#1f5fae"; x.fillRect(100, 60, 320, 180);
      x.fillStyle = "#6b4523"; x.fillRect(100, 240, 320, 180);
      x.strokeStyle = "#fff"; x.beginPath(); x.moveTo(100, 240); x.lineTo(420, 240); x.stroke();
      for (let i = -3; i <= 3; i++) if (i) { x.beginPath(); x.moveTo(226, 240 - i * 28); x.lineTo(286, 240 - i * 28); x.stroke(); }
      x.restore();
      x.strokeStyle = "#ffd400"; x.lineWidth = 6; x.beginPath(); x.moveTo(190, 240); x.lineTo(236, 240); x.moveTo(276, 240); x.lineTo(322, 240); x.stroke();
      x.fillStyle = "#30363f"; x.fillRect(30, 90, 80, 300); x.fillRect(402, 90, 90, 300);
      x.fillStyle = "#fff";
      for (let i = 0; i < 6; i++) { x.fillText(String(300 - i * 10 + 20), 70, 110 + i * 56); x.fillText(String(35400 - i * 200 + 400), 447, 110 + i * 56); }
      x.fillStyle = "#000"; x.fillRect(28, 222, 86, 36); x.fillRect(398, 222, 100, 36);
      x.strokeStyle = "#fff"; x.lineWidth = 2; x.strokeRect(28, 222, 86, 36); x.strokeRect(398, 222, 100, 36);
      x.fillStyle = "#fff"; x.fillText("473", 71, 241); x.fillText("35000", 448, 241);
      x.fillStyle = "#2be36b"; x.fillText("LNAV      VNAV PTH", 256, 40);
      x.fillStyle = "#30363f"; x.fillRect(130, 420, 252, 70);
      x.fillStyle = "#fff"; x.fillText("025", 256, 455);
    } else if (kind === "nd") {
      x.strokeStyle = "#e8e8e8"; x.lineWidth = 2;
      x.beginPath(); x.arc(256, 440, 360, Math.PI * 1.18, Math.PI * 1.82); x.stroke();
      x.beginPath(); x.arc(256, 440, 180, Math.PI * 1.18, Math.PI * 1.82); x.stroke();
      for (let a = -50; a <= 50; a += 10) { const r = (a - 90) * Math.PI / 180; x.beginPath(); x.moveTo(256 + Math.cos(r) * 360, 440 + Math.sin(r) * 360); x.lineTo(256 + Math.cos(r) * 340, 440 + Math.sin(r) * 340); x.stroke(); }
      x.strokeStyle = "#ff3cf0"; x.lineWidth = 4; x.beginPath(); x.moveTo(256, 440); x.lineTo(300, 230); x.lineTo(338, 70); x.stroke();
      x.fillStyle = "#ff3cf0"; x.fillText("IGARI", 380, 230); x.fillText("BITOD", 395, 70);
      x.fillStyle = "#e8e8e8"; x.fillText("TRK 025 M", 256, 40); x.fillText("GS473  TAS480", 120, 490);
      x.strokeStyle = "#e8e8e8"; x.beginPath(); x.moveTo(246, 440); x.lineTo(256, 412); x.lineTo(266, 440); x.closePath(); x.stroke();
      x.fillStyle = "#2be36b"; x.fillText("WXR OFF", 420, 490);
    } else if (kind === "eicas") {
      for (let e = 0; e < 2; e++) for (let g = 0; g < 2; g++) {
        const cx = 150 + e * 210, cy = 120 + g * 150;
        x.strokeStyle = "#e8e8e8"; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, 60, Math.PI * 0.8, Math.PI * 2.0); x.stroke();
        x.strokeStyle = "#e8e8e8"; x.beginPath(); x.moveTo(cx, cy); const a = Math.PI * (1.55 + g * 0.1); x.lineTo(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58); x.stroke();
        x.fillStyle = "#fff"; x.fillText(g ? "742" : "88.4", cx + 40, cy + 30);
      }
      x.fillStyle = "#e8e8e8"; x.fillText("N1", 256, 120); x.fillText("EGT", 256, 270);
      x.fillStyle = "#2be36b"; x.fillText("FUEL  48.9", 256, 400); x.fillStyle = "#e8e8e8"; x.fillText("TAT -23c", 256, 450);
    } else {
      x.fillStyle = "#2be36b";
      ["ACT RTE 1 LEGS", "", "IGARI     025°  37NM", "BITOD     046°  37NM", "", "", "", "ZBAA"].forEach((l, i) => { x.textAlign = "left"; x.fillText(l, 40, 60 + i * 52); });
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [kind, side]);
}

const Screen: React.FC<{ kind: Kind; pos: [number, number, number]; w?: number; side?: number; dim?: number }> = ({ kind, pos, w = 0.2, side = 0, dim = 1 }) => {
  const tex = useDisplay(kind, side);
  return (
    <group position={pos}>
      <mesh position={[0, 0, -0.006]}><planeGeometry args={[w * 1.12, w * 1.12]} /><meshStandardMaterial color="#0d0f12" roughness={0.6} /></mesh>
      <mesh><planeGeometry args={[w, w]} /><meshBasicMaterial map={tex} color={new THREE.Color(dim, dim, dim)} toneMapped={false} /></mesh>
    </group>
  );
};

/** One pilot from behind: seat, white uniform shirt with epaulettes, head, headset. */
const Pilot: React.FC<{ pos: [number, number, number]; m: Record<string, THREE.Material>; stripes: number; t: number; tilt?: number }> = ({ pos, m, stripes, t, tilt = 0 }) => (
  <group position={pos}>
    {/* seat back */}
    <mesh material={m.seat} position={[0, -0.05, -0.3]}><boxGeometry args={[0.56, 0.7, 0.12]} /></mesh>
    <group position={[0, 0, -0.08]} rotation={[0, 0, 0]}>
      <mesh material={m.shirt} position={[0, 0.25, 0]} scale={[1, 0.95, 0.62]}><sphereGeometry args={[0.24, 24, 16]} /></mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.19, 0.42, 0]}>
          <mesh material={m.shirt} scale={[1.1, 0.6, 0.9]}><sphereGeometry args={[0.1, 14, 10]} /></mesh>
          <mesh material={m.epaulette} position={[0, 0.055, 0]} rotation={[0, 0, s * 0.35]}><boxGeometry args={[0.13, 0.012, 0.06]} /></mesh>
          {Array.from({ length: stripes }, (_, i) => <mesh key={i} material={m.gold} position={[s * (-0.04 + i * 0.024) * Math.cos(0.35), 0.062 + s * (-0.04 + i * 0.024) * Math.sin(0.35) * s, 0]} rotation={[0, 0, s * 0.35]}><boxGeometry args={[0.008, 0.004, 0.062]} /></mesh>)}
        </group>
      ))}
      <group position={[0, 0.66, 0.02]} rotation={[Math.sin(t * 0.4) * 0.03 + tilt, Math.sin(t * 0.25) * 0.05, 0]}>
        <mesh material={m.skin} position={[0, -0.08, 0]}><cylinderGeometry args={[0.055, 0.06, 0.12, 12]} /></mesh>
        <mesh material={m.hair} scale={[0.9, 1.05, 1]}><sphereGeometry args={[0.105, 20, 16]} /></mesh>
        <mesh material={m.headset} rotation={[0, 0, 0]} position={[0, 0.02, 0]}><torusGeometry args={[0.112, 0.012, 8, 24, Math.PI]} /></mesh>
        {[-1, 1].map((s) => <mesh key={s} material={m.headset} position={[s * 0.105, -0.01, 0.01]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.042, 0.042, 0.03, 16]} /></mesh>)}
      </group>
    </group>
  </group>
);

/**
 * Boeing 777-style glass cockpit at night (generic), metres. Camera sits behind and between the seats looking forward (+Z).
 * x: left(-)/right(+), y: up, z: forward.
 */
export const Cockpit777: React.FC<{ t: number; shake?: number; env?: THREE.Texture | null; talk?: number }> = ({ t, shake = 0, env = null, talk = 0 }) => {
  const m = useMemo(() => ({
    panel: new THREE.MeshStandardMaterial({ color: "#20252b", roughness: 0.75, metalness: 0.15 }),
    glare: new THREE.MeshStandardMaterial({ color: "#14171b", roughness: 0.9 }),
    frame: new THREE.MeshStandardMaterial({ color: "#2b3036", roughness: 0.6, metalness: 0.2 }),
    seat: new THREE.MeshStandardMaterial({ color: "#33363c", roughness: 0.75 }),
    shirt: new THREE.MeshStandardMaterial({ color: "#c9cdd2", roughness: 0.85 }),
    epaulette: new THREE.MeshStandardMaterial({ color: "#11151c", roughness: 0.7 }),
    gold: new THREE.MeshStandardMaterial({ color: "#c9a245", roughness: 0.35, metalness: 0.9, emissive: "#3a2a08" }),
    skin: new THREE.MeshStandardMaterial({ color: "#7a5440", roughness: 0.7 }),
    hair: new THREE.MeshStandardMaterial({ color: "#121112", roughness: 0.8 }),
    headset: new THREE.MeshStandardMaterial({ color: "#26282c", roughness: 0.4, metalness: 0.4, envMap: env }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#a8c4e0", transparent: true, opacity: 0.06, roughness: 0.05, envMap: env, envMapIntensity: 0.6 }),
    amber: new THREE.MeshBasicMaterial({ color: "#ffb347", toneMapped: false }),
    green: new THREE.MeshBasicMaterial({ color: "#5dff9a", toneMapped: false }),
  }), [env]);
  const sx = Math.sin(t * 23) * shake * 0.002, sy = Math.cos(t * 19) * shake * 0.002;
  const knobs = useMemo(() => {
    let s = 4;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 70 }, () => ({ x: -0.75 + r() * 1.5, z: 0.0 + r() * 0.6, c: r() < 0.25 ? "amber" : r() < 0.4 ? "green" : "" }));
  }, []);
  return (
    <group position={[sx, sy, 0]}>
      {/* main instrument panel, slightly angled toward the crew */}
      <group position={[0, 1.02, 1.35]} rotation={[-0.12, Math.PI, 0]}>
        <mesh material={m.panel} position={[0, 0, -0.035]}><boxGeometry args={[1.9, 0.36, 0.04]} /></mesh>
        <Screen kind="pfd" pos={[0.72, 0, 0]} side={0} />
        <Screen kind="nd" pos={[0.48, 0, 0]} side={0} />
        <Screen kind="eicas" pos={[0, 0.0, 0]} w={0.22} />
        <Screen kind="nd" pos={[-0.48, 0, 0]} side={1} />
        <Screen kind="pfd" pos={[-0.72, 0, 0]} side={1} />
      </group>
      {/* glareshield + MCP */}
      <mesh material={m.glare} position={[0, 1.24, 1.3]} rotation={[0.2, 0, 0]}><boxGeometry args={[2.0, 0.07, 0.36]} /></mesh>
      <mesh material={m.panel} position={[0, 1.215, 1.13]}><boxGeometry args={[1.3, 0.07, 0.03]} /></mesh>
      {[-0.45, -0.2, 0.08, 0.35].map((x, i) => <mesh key={i} material={m.amber} position={[x, 1.215, 1.113]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.07, 0.02]} /></mesh>)}
      {/* pedestal with lower display */}
      <mesh material={m.panel} position={[0, 0.66, 1.0]} rotation={[-0.9, 0, 0]}><boxGeometry args={[0.42, 0.7, 0.2]} /></mesh>
      <group position={[0, 0.78, 1.08]} rotation={[-0.75, Math.PI, 0]}><Screen kind="mfd" pos={[0, 0, 0.11]} w={0.18} dim={0.8} /></group>
      {/* side consoles */}
      {[-1, 1].map((s) => <mesh key={s} material={m.panel} position={[s * 0.98, 0.72, 0.65]}><boxGeometry args={[0.3, 0.14, 1.3]} /></mesh>)}
      {/* overhead panel with small lit annunciators */}
      <group position={[0, 1.92, 0.75]} rotation={[0.3, 0, 0]}>
        <mesh material={m.panel}><boxGeometry args={[1.5, 0.04, 0.9]} /></mesh>
        {knobs.map((k, i) => k.c ? <mesh key={i} material={k.c === "amber" ? m.amber : m.green} position={[k.x, -0.022, k.z - 0.4]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[0.03, 0.012]} /></mesh> : <mesh key={i} material={m.frame} position={[k.x, -0.03, k.z - 0.4]}><cylinderGeometry args={[0.011, 0.011, 0.025, 8]} /></mesh>)}
      </group>
      {/* windshield frame: centre post + side posts, glass */}
      <mesh material={m.frame} position={[0, 1.5, 1.52]} rotation={[0.55, 0, 0]}><boxGeometry args={[0.07, 0.55, 0.05]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} material={m.frame} position={[s * 0.95, 1.48, 1.42]} rotation={[0.5, s * 0.5, 0]}><boxGeometry args={[0.09, 0.6, 0.05]} /></mesh>)}
      <mesh material={m.frame} position={[0, 1.76, 1.3]} rotation={[1.2, 0, 0]}><boxGeometry args={[2.0, 0.1, 0.05]} /></mesh>
      <mesh material={m.glass} position={[0, 1.5, 1.53]} rotation={[0.55, 0, 0]}><planeGeometry args={[1.9, 0.55]} /></mesh>
      {/* crew */}
      <Pilot pos={[-0.52, 0.55, 0.1]} m={m} stripes={4} t={t} tilt={talk * 0.05} />
      <Pilot pos={[0.52, 0.55, 0.1]} m={m} stripes={3} t={t + 3.1} tilt={-0.04} />
      {/* display light spill on the crew */}
      <pointLight position={[-0.5, 1.05, 1.15]} intensity={0.9} distance={2.2} color="#9fc2ff" />
      <pointLight position={[0.5, 1.05, 1.15]} intensity={0.9} distance={2.2} color="#9fc2ff" />
      <pointLight position={[0, 1.6, 0.4]} intensity={0.25} distance={2.5} color="#ffb070" />
      <pointLight position={[0.2, 1.7, -1.0]} intensity={0.5} distance={2.4} color="#6f86b0" />
      <Glow pos={[-0.6, 1.02, 1.3]} color="#4d7dff" size={0.9} intensity={0.12} />
      <Glow pos={[0.6, 1.02, 1.3]} color="#4d7dff" size={0.9} intensity={0.12} />
    </group>
  );
};
