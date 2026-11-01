import React, { useMemo } from "react";
import * as THREE from "three";
import { sphere, box } from "./Common";

const capsule = new THREE.CapsuleGeometry(1, 1, 8, 16);

export type PersonPose = { walk: number; armReach: number; nod: number; wave: number; carry: boolean };

/** Stylised, friendly low-detail human (no real person's likeness). */
export const Person: React.FC<{
  p: [number, number, number];
  rotY: number;
  shirt: string;
  pants?: string;
  skin?: string;
  hair?: string;
  cap?: string | null;
  pose: PersonPose;
  parcel?: boolean;
}> = ({ p, rotY, shirt, pants = "#34405e", skin = "#c88f66", hair = "#2a1d17", cap = null, pose, parcel }) => {
  const m = useMemo(
    () => ({
      shirt: new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.7 }),
      pants: new THREE.MeshStandardMaterial({ color: pants, roughness: 0.8 }),
      skin: new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ color: hair, roughness: 0.8 }),
      cap: new THREE.MeshStandardMaterial({ color: cap ?? shirt, roughness: 0.6 }),
      shoe: new THREE.MeshStandardMaterial({ color: "#1d1f26", roughness: 0.5 }),
      parcel: new THREE.MeshStandardMaterial({ color: "#c9965a", roughness: 0.85 }),
      tape: new THREE.MeshStandardMaterial({ color: "#e9d3a3", roughness: 0.6 }),
      eye: new THREE.MeshStandardMaterial({ color: "#1a1a1a" }),
    }),
    [shirt, pants, skin, hair, cap],
  );
  const s = Math.sin(pose.walk * Math.PI * 2);
  const bob = Math.abs(Math.cos(pose.walk * Math.PI * 2)) * 0.04;
  const reach = pose.armReach;
  const armSwing = s * 0.6 * (1 - reach) * (pose.carry ? 0.2 : 1);
  return (
    <group position={[p[0], p[1] + bob, p[2]]} rotation={[0, rotY, 0]}>
      {/* legs */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.13, 0.85, 0]} rotation={[side * s * 0.55, 0, 0]}>
          <mesh geometry={capsule} material={m.pants} position={[0, -0.4, 0]} scale={[0.1, 0.3, 0.1]} castShadow />
          <mesh geometry={sphere} material={m.shoe} position={[0, -0.82, 0.06]} scale={[0.1, 0.06, 0.16]} castShadow />
        </group>
      ))}
      {/* torso */}
      <mesh geometry={capsule} material={m.shirt} position={[0, 1.22, 0]} scale={[0.26, 0.22, 0.18]} castShadow />
      {/* arms: carry pose holds the parcel in front, reach extends it */}
      {[-1, 1].map((side) => {
        const forward = pose.carry ? 1.1 + reach * 0.4 : armSwing * side + reach * 1.3;
        return (
          <group key={side} position={[side * 0.31, 1.45, 0]} rotation={[-forward, 0, side * (0.08 + (pose.wave && side === 1 ? 2.4 + Math.sin(pose.wave * 20) * 0.3 : 0))]}>
            <mesh geometry={capsule} material={m.shirt} position={[0, -0.18, 0]} scale={[0.075, 0.12, 0.075]} castShadow />
            <mesh geometry={capsule} material={m.skin} position={[0, -0.45, 0]} scale={[0.065, 0.11, 0.065]} castShadow />
          </group>
        );
      })}
      {parcel ? (
        <group position={[0, 1.15 + reach * 0.1, 0.42 + reach * 0.35]}>
          <mesh geometry={box} material={m.parcel} scale={[0.46, 0.32, 0.34]} castShadow />
          <mesh geometry={box} material={m.tape} scale={[0.47, 0.06, 0.345]} />
        </group>
      ) : null}
      {/* head */}
      <group position={[0, 1.72, 0]} rotation={[pose.nod, 0, 0]}>
        <mesh geometry={capsule} material={m.skin} position={[0, -0.12, 0]} scale={[0.07, 0.06, 0.07]} />
        <mesh geometry={sphere} material={m.skin} position={[0, 0.06, 0]} scale={[0.17, 0.2, 0.18]} castShadow />
        <mesh geometry={sphere} material={m.hair} position={[0, 0.14, -0.03]} scale={[0.175, 0.15, 0.17]} />
        <mesh geometry={sphere} material={m.eye} position={[-0.06, 0.08, 0.16]} scale={0.022} />
        <mesh geometry={sphere} material={m.eye} position={[0.06, 0.08, 0.16]} scale={0.022} />
        {cap ? (
          <>
            <mesh geometry={sphere} material={m.cap} position={[0, 0.17, 0]} scale={[0.185, 0.11, 0.185]} castShadow />
            <mesh geometry={box} material={m.cap} position={[0, 0.15, 0.17]} scale={[0.22, 0.02, 0.14]} />
          </>
        ) : null}
      </group>
    </group>
  );
};
