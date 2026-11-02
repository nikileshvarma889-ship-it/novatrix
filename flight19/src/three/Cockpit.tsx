import React, { useMemo } from "react";
import * as THREE from "three";

/** Round instrument dial face drawn on a canvas (white markings on black, 1940s style). */
function useDial(kind: "compass" | "alt" | "speed" | "fuel" | "clock") {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    x.fillStyle = "#0b0c0d"; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill();
    x.strokeStyle = "#d9d4c4"; x.fillStyle = "#d9d4c4"; x.lineWidth = 3;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, l = i % 5 === 0 ? 22 : 11;
      x.beginPath(); x.moveTo(128 + Math.sin(a) * 112, 128 - Math.cos(a) * 112); x.lineTo(128 + Math.sin(a) * (112 - l), 128 - Math.cos(a) * (112 - l)); x.stroke();
    }
    x.font = "bold 26px 'Liberation Mono', monospace"; x.textAlign = "center"; x.textBaseline = "middle";
    const labels = kind === "compass" ? ["N", "3", "6", "E", "12", "15", "S", "21", "24", "W", "30", "33"] : kind === "fuel" ? ["E", "", "", "1/2", "", "", "", "", "", "F", "", ""] : ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "", ""];
    labels.forEach((t, i) => { const a = (i / 12) * Math.PI * 2; x.fillText(t, 128 + Math.sin(a) * 78, 128 - Math.cos(a) * 78); });
    x.font = "bold 16px 'Liberation Mono', monospace";
    x.fillText({ compass: "COMPASS", alt: "ALTITUDE", speed: "KNOTS", fuel: "FUEL GAL", clock: "" }[kind], 128, 170);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [kind]);
}

const Gauge: React.FC<{ kind: "compass" | "alt" | "speed" | "fuel" | "clock"; pos: [number, number, number]; r?: number; needle: number; glass: THREE.Material; rim: THREE.Material }> = ({ kind, pos, r = 0.055, needle, glass, rim }) => {
  const tex = useDial(kind);
  return (
    <group position={pos}>
      <mesh material={rim} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.005]}><cylinderGeometry args={[r * 1.12, r * 1.12, 0.02, 32]} /></mesh>
      <mesh><circleGeometry args={[r, 40]} /><meshStandardMaterial map={tex} roughness={0.6} emissive="#b8ffcc" emissiveMap={tex} emissiveIntensity={0.08} /></mesh>
      <mesh position={[0, 0, 0.004]} rotation={[0, 0, -needle]}>
        <mesh position={[0, r * 0.38, 0]}><planeGeometry args={[r * 0.07, r * 0.8]} /><meshStandardMaterial color="#f2eedd" emissive="#f2eedd" emissiveIntensity={0.25} /></mesh>
      </mesh>
      <mesh material={glass} position={[0, 0, 0.01]}><circleGeometry args={[r, 32]} /></mesh>
    </group>
  );
};

/**
 * TBM Avenger pilot's cockpit (scale in metres). The camera sits behind and above the pilot's right shoulder.
 * compass: heading needle angle; the compass "fails" by swinging erratically.
 */
export const Cockpit: React.FC<{ t: number; compass: number; fuel: number; env?: THREE.Texture | null; shake?: number }> = ({ t, compass, fuel, env = null, shake = 0 }) => {
  const m = useMemo(() => {
    const panel = new THREE.MeshStandardMaterial({ color: "#16191c", roughness: 0.85, metalness: 0.2 });
    const interior = new THREE.MeshStandardMaterial({ color: "#3e4a3a", roughness: 0.8 });          // interior green
    const frame = new THREE.MeshStandardMaterial({ color: "#1d2a40", roughness: 0.45, metalness: 0.3, envMap: env });
    const rim = new THREE.MeshStandardMaterial({ color: "#2a2c30", roughness: 0.4, metalness: 0.7, envMap: env });
    const glass = new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.1, roughness: 0.05, envMap: env, envMapIntensity: 1.2 });
    const leather = new THREE.MeshStandardMaterial({ color: "#3a2618", roughness: 0.7 });
    const jacket = new THREE.MeshStandardMaterial({ color: "#4a3a26", roughness: 0.9 });
    const strap = new THREE.MeshStandardMaterial({ color: "#1b1410", roughness: 0.8 });
    const goggle = new THREE.MeshStandardMaterial({ color: "#7c8a92", roughness: 0.15, metalness: 0.8, envMap: env });
    return { panel, interior, frame, rim, glass, leather, jacket, strap, goggle };
  }, [env]);
  const sx = Math.sin(t * 31) * shake * 0.004, sy = Math.cos(t * 27) * shake * 0.004;
  return (
    <group position={[sx, sy, 0]}>
      {/* instrument panel */}
      <group position={[0.75, 0.82, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={m.panel} position={[0, 0, -0.02]}><boxGeometry args={[0.9, 0.42, 0.04]} /></mesh>
        <mesh material={m.interior} position={[0, 0.24, 0.08]} rotation={[-0.9, 0, 0]}><boxGeometry args={[0.95, 0.18, 0.02]} /></mesh>
        <Gauge kind="compass" pos={[0, 0.07, 0.01]} r={0.075} needle={compass} glass={m.glass} rim={m.rim} />
        <Gauge kind="alt" pos={[-0.22, 0.08, 0.01]} needle={1.2 + Math.sin(t * 0.3) * 0.05} glass={m.glass} rim={m.rim} />
        <Gauge kind="speed" pos={[0.22, 0.08, 0.01]} needle={2.4 + Math.sin(t * 1.7) * 0.03} glass={m.glass} rim={m.rim} />
        <Gauge kind="fuel" pos={[-0.22, -0.1, 0.01]} needle={fuel} glass={m.glass} rim={m.rim} />
        <Gauge kind="clock" pos={[0.22, -0.1, 0.01]} needle={t * 0.01 + 3.6} glass={m.glass} rim={m.rim} />
        <Gauge kind="alt" pos={[0, -0.12, 0.01]} r={0.045} needle={0.4 + Math.sin(t * 0.9) * 0.4} glass={m.glass} rim={m.rim} />
      </group>
      {/* side walls / sills */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={m.interior} position={[0.2, 0.55, 0.42 * s]}><boxGeometry args={[1.4, 0.5, 0.04]} /></mesh>
      ))}
      {/* canopy frame bows + rails */}
      {[0.55, 0.05, -0.45].map((x) => (
        <mesh key={x} material={m.frame} position={[x, 0.82, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.48, 0.022, 8, 32, Math.PI]} /></mesh>
      ))}
      <mesh material={m.frame} position={[0.05, 1.3, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 1.1, 8]} /></mesh>
      {/* windscreen front frame */}
      <mesh material={m.frame} position={[0.95, 1.0, 0]} rotation={[0, 0, 0.5]}><boxGeometry args={[0.03, 0.42, 0.62]} /></mesh>
      {/* pilot (from behind): leather helmet, goggle strap, jacket, collar */}
      <group position={[-0.2, 0.75, 0]}>
        <mesh material={m.jacket} position={[0, -0.12, 0]} scale={[0.75, 0.6, 1.05]}><sphereGeometry args={[0.32, 24, 16]} /></mesh>
        <mesh material={m.leather} position={[0.02, 0.27, 0]} scale={[1, 1.08, 0.92]}><sphereGeometry args={[0.12, 24, 18]} /></mesh>
        <mesh material={m.strap} position={[0.02, 0.29, 0]} rotation={[0, 0, 0.15]}><torusGeometry args={[0.121, 0.012, 6, 32]} /></mesh>
        <mesh material={m.goggle} position={[0.1, 0.33, 0.05]}><sphereGeometry args={[0.03, 12, 8]} /></mesh>
        <mesh material={m.goggle} position={[0.1, 0.33, -0.05]}><sphereGeometry args={[0.03, 12, 8]} /></mesh>
        <mesh material={m.leather} position={[0.0, 0.2, 0.11]} scale={[0.6, 1.2, 0.3]}><sphereGeometry args={[0.05, 12, 8]} /></mesh>
        {/* right arm reaching for the stick */}
        <mesh material={m.jacket} position={[0.18, -0.12, -0.2]} rotation={[0, 0, -1.2]}><capsuleGeometry args={[0.055, 0.28, 6, 12]} /></mesh>
        <mesh material={m.strap} position={[0.38, -0.25, -0.12]}><sphereGeometry args={[0.045, 12, 8]} /></mesh>
      </group>
      <mesh material={m.strap} position={[0.25, 0.35, -0.08]} rotation={[0, 0, -0.25]}><cylinderGeometry args={[0.015, 0.02, 0.5, 8]} /></mesh>
    </group>
  );
};
