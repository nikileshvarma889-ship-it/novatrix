import React, { useMemo } from "react";
import * as THREE from "three";
import { fabricTexture, furTexture } from "../lib/textures";
import { SPECIES, Species } from "./species";

/** Everything the animation system can drive on a character. */
export type Pose = {
  x: number;
  y: number; // jump height
  z: number;
  rotY: number;
  squash: number; // 1 = neutral, <1 squashed (landing), >1 stretched (take-off)
  lean: number; // forward/back body lean (rad)
  sway: number; // side-to-side body roll (rad)
  twist: number; // upper-body twist (rad)
  headNod: number;
  headTurn: number;
  headTilt: number;
  armL: { raise: number; forward: number; wave: number };
  armR: { raise: number; forward: number; wave: number };
  legL: number;
  legR: number;
  earFlop: number;
  blink: number; // 0 open .. 1 closed
  happyEyes: number; // 0..1 squint of joy
  mouthOpen: number; // 0..1
  smile: number; // 0..1
  brows: number; // -1 frown .. 1 raised
  lookX: number;
  lookY: number;
};

export const neutralPose = (): Pose => ({
  x: 0, y: 0, z: 0, rotY: 0, squash: 1, lean: 0, sway: 0, twist: 0,
  headNod: 0, headTurn: 0, headTilt: 0,
  armL: { raise: 0.15, forward: 0, wave: 0 }, armR: { raise: 0.15, forward: 0, wave: 0 },
  legL: 0, legR: 0, earFlop: 0, blink: 0, happyEyes: 0, mouthOpen: 0, smile: 0.6, brows: 0, lookX: 0, lookY: 0,
});

const sphere = new THREE.SphereGeometry(1, 48, 32);
const capsule = new THREE.CapsuleGeometry(1, 1, 10, 24);

type Mats = Record<"fur" | "light" | "inner" | "nose" | "eyeWhite" | "iris" | "pupil" | "shine" | "mouth" | "tongue" | "cheek" | "brow" | "outfitA" | "outfitB" | "accent" | "mane", THREE.Material>;

function makeMaterials(s: Species): Mats {
  const fur = furTexture();
  const fabric = fabricTexture();
  const furMat = (color: string) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.82, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.5), bumpMap: fur, bumpScale: 0.6 });
  const cloth = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, bumpMap: fabric, bumpScale: 0.35 });
  return {
    fur: furMat(s.fur),
    light: furMat(s.furLight),
    inner: new THREE.MeshStandardMaterial({ color: s.inner, roughness: 0.7 }),
    nose: new THREE.MeshPhysicalMaterial({ color: s.nose, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.2 }),
    eyeWhite: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.15, clearcoat: 1 }),
    iris: new THREE.MeshPhysicalMaterial({ color: s.iris, roughness: 0.2, clearcoat: 1 }),
    pupil: new THREE.MeshPhysicalMaterial({ color: "#14100e", roughness: 0.1, clearcoat: 1 }),
    shine: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    mouth: new THREE.MeshStandardMaterial({ color: "#5a1c1c", roughness: 0.6 }),
    tongue: new THREE.MeshStandardMaterial({ color: "#ff7c8f", roughness: 0.5 }),
    cheek: new THREE.MeshStandardMaterial({ color: s.cheek, roughness: 0.9, transparent: true, opacity: 0.75 }),
    brow: new THREE.MeshStandardMaterial({ color: s.brow, roughness: 0.8 }),
    outfitA: cloth(s.outfitA),
    outfitB: cloth(s.outfitB),
    accent: new THREE.MeshPhysicalMaterial({ color: s.accent, roughness: 0.3, clearcoat: 0.8 }),
    mane: furMat(s.mane ?? s.fur),
  };
}

/** A unit-sphere mesh scaled to radius × stretch. */
const Ball: React.FC<{ m: THREE.Material; r: number; s?: [number, number, number]; p?: [number, number, number]; rot?: [number, number, number]; shadow?: boolean }> = ({ m, r, s = [1, 1, 1], p = [0, 0, 0], rot = [0, 0, 0], shadow = true }) => (
  <mesh geometry={sphere} material={m} position={p} rotation={rot} scale={[r * s[0], r * s[1], r * s[2]]} castShadow={shadow} receiveShadow={shadow} />
);

const Arm: React.FC<{ side: 1 | -1; a: Pose["armL"]; mats: Mats; s: Species }> = ({ side, a, mats, s }) => (
  <group position={[side * 0.43, 0.56, 0]} rotation={[-a.forward, 0, side * (a.raise + Math.sin(a.wave) * 0.35 * (a.raise > 1 ? 1 : 0))]}>
    <Ball m={s.sleeves ? mats.outfitA : mats.fur} r={0.17} />
    <group position={[0, -0.24, 0]}>
      <mesh geometry={capsule} material={mats.fur} scale={[0.115, 0.14, 0.115]} castShadow />
    </group>
    <Ball m={mats.light} r={0.135} p={[0, -0.42, 0.01]} s={[1, 0.95, 0.9]} />
  </group>
);

const Leg: React.FC<{ side: 1 | -1; swing: number; mats: Mats; s: Species }> = ({ side, swing, mats, s }) => (
  <group position={[side * 0.21, 0.02, 0]} rotation={[swing, 0, 0]}>
    <mesh geometry={capsule} material={s.pants ? mats.outfitB : mats.fur} position={[0, -0.2, 0]} scale={[0.14, 0.12, 0.14]} castShadow />
    <Ball m={mats.light} r={0.17} s={[1, 0.62, 1.35]} p={[0, -0.42, 0.07]} />
  </group>
);

const Eye: React.FC<{ side: 1 | -1; pose: Pose; mats: Mats }> = ({ side, pose, mats }) => {
  const open = Math.max(0.06, 1 - pose.blink) * (1 - 0.6 * pose.happyEyes);
  return (
    <group position={[side * 0.2, 0.5, 0.44]} rotation={[0, side * 0.18, 0]} scale={[1, open, 1]}>
      <Ball m={mats.eyeWhite} r={0.135} s={[0.9, 1.12, 0.6]} shadow={false} />
      <group position={[pose.lookX * 0.03, pose.lookY * 0.03, 0.055]}>
        <Ball m={mats.iris} r={0.097} s={[0.95, 1.1, 0.5]} shadow={false} />
        <Ball m={mats.pupil} r={0.062} s={[0.95, 1.1, 0.5]} p={[0, 0, 0.022]} shadow={false} />
        <Ball m={mats.shine} r={0.03} p={[-0.032, 0.045, 0.058]} shadow={false} />
        <Ball m={mats.shine} r={0.014} p={[0.035, -0.035, 0.058]} shadow={false} />
      </group>
    </group>
  );
};

const Mouth: React.FC<{ pose: Pose; mats: Mats }> = ({ pose, mats }) => {
  const open = pose.mouthOpen;
  const smileArc = useMemo(() => new THREE.TorusGeometry(0.095, 0.013, 10, 32, Math.PI), []);
  return (
    <group position={[0, 0.17, 0.6]} rotation={[-0.25, 0, 0]}>
      {open < 0.12 ? (
        <mesh geometry={smileArc} material={mats.mouth} rotation={[0, 0, Math.PI]} scale={[1, 0.38 + pose.smile * 0.3, 1]} />
      ) : (
        <group scale={[1 + pose.smile * 0.15, 0.25 + open * 1.0, 1]}>
          <Ball m={mats.mouth} r={0.095} s={[1.05, 0.9, 0.45]} shadow={false} />
          <Ball m={mats.tongue} r={0.06} s={[1.1, 0.55, 0.4]} p={[0, -0.04, 0.02]} shadow={false} />
        </group>
      )}
    </group>
  );
};

export const Character: React.FC<{ kind: keyof typeof SPECIES; pose: Pose }> = ({ kind, pose }) => {
  const s = SPECIES[kind];
  const mats = useMemo(() => makeMaterials(s), [s]);
  const sq = pose.squash;
  return (
    <group position={[pose.x, pose.y, pose.z]} rotation={[0, pose.rotY, 0]} scale={[1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)]}>
      {/* soft contact shadow helper so feet always read as grounded */}
      <group position={[0, 0.5, 0]} rotation={[pose.lean, pose.twist * 0.3, pose.sway]}>
        {/* body */}
        <Ball m={mats.fur} r={0.5} s={[1, 1.1, 0.9]} p={[0, 0.25, 0]} />
        {s.renderOutfit(mats)}
        {s.renderTail(mats)}
        <Arm side={-1} a={pose.armL} mats={mats} s={s} />
        <Arm side={1} a={pose.armR} mats={mats} s={s} />
        <Leg side={-1} swing={pose.legL} mats={mats} s={s} />
        <Leg side={1} swing={pose.legR} mats={mats} s={s} />
        {/* head */}
        <group position={[0, 0.78, 0]} rotation={[pose.headNod, pose.headTurn + pose.twist * 0.5, pose.headTilt]}>
          {s.renderBehindHead(mats, pose)}
          <Ball m={mats.fur} r={0.56} s={[1.06, 0.96, 0.95]} p={[0, 0.42, 0]} />
          <Ball m={mats.light} r={0.24} s={[1.3, 0.85, 0.8]} p={[0, 0.25, 0.43]} />
          <Ball m={mats.nose} r={0.07} s={[1.35, 0.9, 0.9]} p={[0, 0.35, 0.62]} />
          <Eye side={-1} pose={pose} mats={mats} />
          <Eye side={1} pose={pose} mats={mats} />
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.21, 0.69 + Math.max(-0.5, Math.min(1.2, pose.brows)) * 0.04, 0.47]} rotation={[0, side * 0.2, side * 0.03]}>
              <mesh geometry={capsule} material={mats.brow} rotation={[0, 0, Math.PI / 2]} scale={[0.022, 0.05, 0.022]} />
            </group>
          ))}
          <Ball m={mats.cheek} r={0.085} s={[1.1, 0.65, 0.35]} p={[-0.34, 0.27, 0.4]} rot={[0, -0.6, 0]} shadow={false} />
          <Ball m={mats.cheek} r={0.085} s={[1.1, 0.65, 0.35]} p={[0.34, 0.27, 0.4]} rot={[0, 0.6, 0]} shadow={false} />
          <Mouth pose={pose} mats={mats} />
          {s.renderEars(mats, pose)}
        </group>
      </group>
    </group>
  );
};

export { Ball, capsule, sphere };
export type { Mats };
