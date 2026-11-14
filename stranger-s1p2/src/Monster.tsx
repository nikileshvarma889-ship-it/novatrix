import React, { useMemo } from "react";
import * as THREE from "three";
import { Glow } from "./three/Lights";
import { hash, Limb, type V3 } from "./Scenes3D";

/* An original creature for this fan recap: very tall, skeletal, pale and sinewy, with long clawed arms,
   backward-bending legs and a smooth eyeless head split by one glowing red slit. Lit with red rim light. */

const skinTex = () => {
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d")!;
  x.fillStyle = "#8d827c"; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${60 + hash(i, 1) * 50},${45 + hash(i, 2) * 30},${45 + hash(i, 3) * 30},${0.08 + hash(i, 4) * 0.12})`; x.beginPath(); x.ellipse(hash(i, 5) * 512, hash(i, 6) * 512, 2 + hash(i, 7) * 14, 1 + hash(i, 8) * 4, hash(i, 9) * 3, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = "rgba(70,40,45,0.35)"; x.lineWidth = 1.5;
  for (let i = 0; i < 70; i++) { x.beginPath(); let px = hash(i, 10) * 512, py = hash(i, 11) * 512; x.moveTo(px, py); for (let j = 0; j < 8; j++) { px += (hash(i * 9 + j, 12) - 0.5) * 50; py += hash(i * 9 + j, 13) * 40; x.lineTo(px, py); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
};

export const Monster: React.FC<{ pos: V3; rotY?: number; t: number; opacity?: number; scale?: number; walk?: number; reach?: number }> = ({ pos, rotY = 0, t, opacity = 1, scale = 1, walk = 0, reach = 0 }) => {
  const m = useMemo(() => {
    const map = skinTex();
    return {
      skin: new THREE.MeshStandardMaterial({ color: "#c9bcb4", map, bumpMap: map, bumpScale: 0.6, roughness: 0.62, metalness: 0.05, transparent: true }),
      claw: new THREE.MeshStandardMaterial({ color: "#1a1412", roughness: 0.3, transparent: true }),
      slit: new THREE.MeshBasicMaterial({ color: "#ff2a1e", toneMapped: false, transparent: true }),
    };
  }, []);
  for (const k of [m.skin, m.claw, m.slit]) k.opacity = opacity;
  if (opacity <= 0.01) return null;
  // jerky gait: the phase advances in uneven lurches
  const ph = (t + 0.25 * Math.sin(t * 3.1) + 0.12 * Math.sin(t * 7.7)) * 2.4 * walk;
  const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
  const twitch = Math.sin(t * 13) * Math.sin(t * 2.3) > 0.6 ? 0.25 : 0;
  const lean = 0.28;
  // skeleton (metres, creature stands ~2.6 m)
  const hip: V3 = [0, 1.32, 0], chest: V3 = [0, 2.02, 0.22], neck: V3 = [0, 2.2, 0.32], head: V3 = [0, 2.42, 0.42];
  const leg = (side: number, s: number) => {
    const h: V3 = [side * 0.12, 1.3, 0];
    const knee: V3 = [side * 0.16, 0.82 + Math.max(0, s) * 0.08, 0.22 + s * 0.18];
    const ankle: V3 = [side * 0.15, 0.32 + Math.max(0, s) * 0.12, -0.12 + s * 0.22];
    const foot: V3 = [side * 0.15, 0.02 + Math.max(0, s) * 0.06, 0.12 + s * 0.3];
    return { h, knee, ankle, foot };
  };
  const arm = (side: number, s: number) => {
    const sh: V3 = [side * 0.26, 1.98, 0.2];
    const el: V3 = [side * 0.42, 1.38, 0.18 - s * 0.15 + reach * 0.3];
    const wr: V3 = [side * 0.46, 0.78 + reach * 0.5, 0.22 - s * 0.25 + reach * 0.75];
    return { sh, el, wr };
  };
  const L = [leg(-1, sL), leg(1, sR)], A = [arm(-1, sR), arm(1, sL)];
  return (
    <group position={pos} rotation={[0, rotY, 0]} scale={scale}>
      {/* red rim light from behind and a low red haze at the feet */}
      <pointLight position={[0.6, 2.4, -1.0]} intensity={9 * opacity} distance={5} color="#ff2418" />
      <pointLight position={[0, 0.3, 0.6]} intensity={2.5 * opacity} distance={3} color="#ff3a22" />
      <pointLight position={[-0.4, 2.0, 1.6]} intensity={3.5 * opacity} distance={4} color="#b8c6dc" />
      <Glow pos={[0, 0.15, 0]} color="#ff2a1a" size={3.2} intensity={0.35 * opacity} fog />
      <group rotation={[lean, 0, 0]}>
        {/* spine, ribcage, pelvis */}
        <Limb a={hip} b={chest} r={0.1} material={m.skin} />
        <mesh material={m.skin} position={[0, 1.52, 0.08]} scale={[0.9, 1.3, 0.65]}><sphereGeometry args={[0.13, 14, 10]} /></mesh>
        <mesh material={m.skin} position={[0, 1.78, 0.16]} scale={[1, 1.25, 0.72]}><sphereGeometry args={[0.2, 18, 14]} /></mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} material={m.skin} position={[0, 1.94 - i * 0.075, 0.2 + i * 0.006]} rotation={[Math.PI / 2 + 0.15, 0, 0]} scale={[1, 0.75, 1]}><torusGeometry args={[0.175 - i * 0.012, 0.012, 6, 22, Math.PI * 1.1]} /></mesh>
        ))}
        <mesh material={m.skin} position={[0, 1.32, 0.02]} scale={[1.3, 0.7, 0.9]}><sphereGeometry args={[0.13, 14, 10]} /></mesh>
        {/* long neck and the eyeless head with its red slit */}
        <Limb a={chest} b={neck} r={0.055} material={m.skin} />
        <group position={head} rotation={[-0.35 + twitch * 0.3, twitch * 0.6, twitch * -0.2]}>
          <mesh material={m.skin} scale={[0.82, 1.35, 0.95]}><sphereGeometry args={[0.13, 22, 18]} /></mesh>
          <mesh material={m.skin} position={[0, 0.06, -0.03]} scale={[0.55, 1.1, 1]}><sphereGeometry args={[0.12, 14, 10]} /></mesh>
          <mesh material={m.slit} position={[0, -0.02, 0.122]}><boxGeometry args={[0.012, 0.21, 0.012]} /></mesh>
          <Glow pos={[0, -0.02, 0.15]} color="#ff2a1e" size={0.18} intensity={0.8 * opacity} />
        </group>
        {/* arms that hang to the knees, four long fingers with dark claws */}
        {A.map((a, i) => {
          const side = i ? 1 : -1;
          return (
            <group key={i}>
              <Limb a={a.sh} b={a.el} r={0.052} material={m.skin} />
              <Limb a={a.el} b={a.wr} r={0.042} material={m.skin} />
              {[0, 1, 2, 3].map((f) => {
                const sp = (f - 1.5) * 0.045;
                const tip: V3 = [a.wr[0] + side * 0.02 + sp, a.wr[1] - 0.26 + Math.abs(sp) * 0.6, a.wr[2] + 0.05 + reach * 0.1];
                const claw: V3 = [tip[0] + sp * 0.4, tip[1] - 0.09, tip[2] + 0.04];
                return (
                  <group key={f}>
                    <Limb a={[a.wr[0] + sp * 0.5, a.wr[1] - 0.02, a.wr[2]]} b={tip} r={0.014} material={m.skin} />
                    <Limb a={tip} b={claw} r={0.006} material={m.claw} />
                  </group>
                );
              })}
            </group>
          );
        })}
      </group>
      {/* backward-bending legs on long feet with clawed toes */}
      {L.map((l, i) => (
        <group key={i}>
          <Limb a={l.h} b={l.knee} r={0.078} material={m.skin} />
          <Limb a={l.knee} b={l.ankle} r={0.056} material={m.skin} />
          <Limb a={l.ankle} b={l.foot} r={0.035} material={m.skin} />
          {[-1, 0, 1].map((k) => <Limb key={k} a={l.foot} b={[l.foot[0] + k * 0.06, 0.01, l.foot[2] + 0.16]} r={0.012} material={m.claw} />)}
        </group>
      ))}
    </group>
  );
};
