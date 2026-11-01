import React, { useMemo } from "react";
import * as THREE from "three";
import { useFabricBump } from "./env";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Gold visor: a reflection-like gradient (sky above, dark horizon band, warm glow below) as emissive map. */
function useVisorMap() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#3a2a10"); g.addColorStop(0.38, "#8a6424"); g.addColorStop(0.5, "#f2c46a"); g.addColorStop(0.56, "#4a3512"); g.addColorStop(1, "#160f06");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    let sd = 4242; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,240,210,${rnd() * 0.6})`; x.fillRect(rnd() * 256, rnd() * 110, 1.5, 1.5); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

type Pose = { armL?: number; armR?: number; elbowL?: number; elbowR?: number; legL?: number; legR?: number; kneeL?: number; kneeR?: number; head?: number };

/** Space-suited astronaut built from primitives with PBR materials (white fabric suit, gold visor). */
export const Astronaut: React.FC<{ env: THREE.Texture; pose?: Pose; visorGlow?: number; visorColor?: string }> = ({ env, pose = {}, visorGlow = 0, visorColor = "#ff9a3c" }) => {
  const bump = useFabricBump();
  const visorMap = useVisorMap();
  const torsoGeo = useMemo(() => new RoundedBoxGeometry(0.8, 0.92, 0.52, 6, 0.17), []);
  const m = useMemo(() => {
    const suit = new THREE.MeshStandardMaterial({ color: "#eceae4", roughness: 0.82, metalness: 0, bumpMap: bump, bumpScale: 0.015, envMap: env, envMapIntensity: 0.6 });
    const suitDark = new THREE.MeshStandardMaterial({ color: "#c9c6bf", roughness: 0.85, bumpMap: bump, bumpScale: 0.02, envMap: env, envMapIntensity: 0.5 });
    const metal = new THREE.MeshStandardMaterial({ color: "#b9bcc4", roughness: 0.35, metalness: 0.9, envMap: env, envMapIntensity: 1 });
    const gold = new THREE.MeshStandardMaterial({ color: "#d9a441", roughness: 0.3, metalness: 1, envMap: env, envMapIntensity: 1.2 });
    const visor = new THREE.MeshPhysicalMaterial({ color: "#caa04a", roughness: 0.08, metalness: 1, envMap: env, envMapIntensity: 2.2, clearcoat: 1, clearcoatRoughness: 0.03, emissive: new THREE.Color("#ffffff"), emissiveMap: visorMap, emissiveIntensity: 0.55 });
    const glass = new THREE.MeshStandardMaterial({ color: "#05070c", roughness: 0.2, metalness: 0.2 });
    const grey = new THREE.MeshStandardMaterial({ color: "#7c808a", roughness: 0.6, metalness: 0.2, envMap: env, envMapIntensity: 0.6 });
    const red = new THREE.MeshStandardMaterial({ color: "#a3322a", roughness: 0.5 });
    const glove = new THREE.MeshStandardMaterial({ color: "#5d6068", roughness: 0.7, bumpMap: bump, bumpScale: 0.02, envMap: env, envMapIntensity: 0.4 });
    const lamp = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: new THREE.Color("#fff6e0"), emissiveIntensity: 2.5 });
    return { suit, suitDark, metal, gold, visor, glass, grey, red, glove, lamp };
  }, [env, bump, visorColor]);
  m.visor.emissiveIntensity = 0.55 + visorGlow;
  m.visor.emissive.set(visorGlow > 0.05 ? new THREE.Color("#ffffff").lerp(new THREE.Color(visorColor), Math.min(1, visorGlow)) : "#ffffff");

  const Limb: React.FC<{ r: number; len: number; mat: THREE.Material }> = ({ r, len, mat }) => (
    <mesh material={mat} position={[0, -len / 2 - r * 0.2, 0]} castShadow>
      <capsuleGeometry args={[r, len, 8, 20]} />
    </mesh>
  );
  const Arm: React.FC<{ side: 1 | -1; raise: number; elbow: number }> = ({ side, raise, elbow }) => (
    <group position={[0.43 * side, 0.27, 0]} rotation={[0.15, 0, side * (0.35 + raise)]}>
      <mesh material={m.suitDark}><sphereGeometry args={[0.13, 20, 16]} /></mesh>
      <Limb r={0.105} len={0.26} mat={m.suit} />
      <group position={[0, -0.36, 0]} rotation={[-elbow, 0, 0]}>
        <mesh material={m.suitDark}><sphereGeometry args={[0.1, 16, 12]} /></mesh>
        <Limb r={0.095} len={0.24} mat={m.suit} />
        <mesh material={m.metal} position={[0, -0.34, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.085, 0.022, 10, 24]} /></mesh>
        <mesh material={m.glove} position={[0, -0.43, 0.01]} scale={[1, 1.15, 0.75]}><sphereGeometry args={[0.095, 18, 14]} /></mesh>
      </group>
    </group>
  );
  const Leg: React.FC<{ side: 1 | -1; swing: number; knee: number }> = ({ side, swing, knee }) => (
    <group position={[0.17 * side, -0.52, 0]} rotation={[swing, 0, side * 0.06]}>
      <mesh material={m.suitDark}><sphereGeometry args={[0.15, 20, 16]} /></mesh>
      <Limb r={0.135} len={0.32} mat={m.suit} />
      <group position={[0, -0.46, 0]} rotation={[knee, 0, 0]}>
        <mesh material={m.suitDark}><sphereGeometry args={[0.125, 16, 12]} /></mesh>
        <Limb r={0.12} len={0.3} mat={m.suit} />
        <mesh material={m.grey} position={[0, -0.5, 0.05]} scale={[1, 0.75, 1.5]}><sphereGeometry args={[0.13, 20, 14]} /></mesh>
      </group>
    </group>
  );
  return (
    <group>
      {/* torso: rounded hard-upper-torso shell + soft lower suit + waist bearing ring */}
      <mesh material={m.suit} geometry={torsoGeo} position={[0, 0.12, 0]} />
      <mesh material={m.suitDark} position={[0, -0.42, 0]} scale={[1.05, 0.7, 0.8]}><sphereGeometry args={[0.36, 32, 20]} /></mesh>
      <mesh material={m.grey} position={[0, -0.3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.15, 0.85, 1]}><torusGeometry args={[0.33, 0.035, 12, 40]} /></mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} material={m.grey} position={[x, 0.36, 0.25]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.05, 0.3, 0.03]} /></mesh>
      ))}
      {/* chest control unit */}
      <group position={[0, 0.06, 0.33]}>
        <mesh material={m.grey}><boxGeometry args={[0.34, 0.2, 0.1]} /></mesh>
        {[-0.1, 0, 0.1].map((x, i) => (
          <mesh key={i} material={i === 1 ? m.red : m.gold} position={[x, 0.02, 0.06]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.022, 0.022, 0.03, 16]} /></mesh>
        ))}
      </group>
      {/* backpack (life support) */}
      <group position={[0, 0.08, -0.43]}>
        <mesh material={m.suitDark} scale={[1, 1, 1]}><boxGeometry args={[0.74, 0.92, 0.34]} /></mesh>
        <mesh material={m.suit} position={[0, 0.54, 0.02]}><boxGeometry args={[0.6, 0.18, 0.3]} /></mesh>
        <mesh material={m.metal} position={[0.3, -0.3, 0.2]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 0.2, 12]} /></mesh>
      </group>
      {/* neck ring + helmet */}
      <mesh material={m.metal} position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.21, 0.04, 14, 40]} /></mesh>
      <group position={[0, 0.82, 0.02]} rotation={[pose.head ?? 0, 0, 0]}>
        <mesh material={m.suit}><sphereGeometry args={[0.31, 40, 30]} /></mesh>
        <mesh material={m.glass}><sphereGeometry args={[0.305, 32, 24, -0.2, Math.PI + 0.4, 0.6, 1.5]} /></mesh>
        <mesh material={m.visor} scale={[1.03, 1.03, 1.03]}><sphereGeometry args={[0.31, 48, 36, Math.PI * 0.03, Math.PI * 0.94, 0.62, 1.42]} /></mesh>
        <mesh material={m.metal} position={[0, 0.27, 0.12]} rotation={[0.5, 0, 0]}><boxGeometry args={[0.16, 0.05, 0.12]} /></mesh>
        {[-1, 1].map((sd) => (
          <group key={sd} position={[0.29 * sd, 0.08, 0.02]} rotation={[0, 0, 0]}>
            <mesh material={m.grey}><boxGeometry args={[0.06, 0.09, 0.14]} /></mesh>
            <mesh material={m.lamp} position={[0, 0, 0.075]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.01, 16]} /></mesh>
          </group>
        ))}
      </group>
      <Arm side={1} raise={pose.armR ?? 0.3} elbow={pose.elbowR ?? 0.5} />
      <Arm side={-1} raise={pose.armL ?? 0.2} elbow={pose.elbowL ?? 0.7} />
      <Leg side={1} swing={pose.legR ?? 0.25} knee={pose.kneeR ?? 0.5} />
      <Leg side={-1} swing={pose.legL ?? -0.1} knee={pose.kneeL ?? 0.35} />
    </group>
  );
};
