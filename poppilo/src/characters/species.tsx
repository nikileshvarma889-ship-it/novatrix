import React from "react";
import * as THREE from "three";
import type { Mats, Pose } from "./Character";
import { Ball, capsule, sphere } from "./Character";

export type Species = {
  name: string;
  fur: string;
  furLight: string;
  inner: string;
  nose: string;
  iris: string;
  cheek: string;
  brow: string;
  outfitA: string;
  outfitB: string;
  accent: string;
  mane?: string;
  sleeves: boolean;
  pants: boolean;
  renderOutfit: (m: Mats) => React.ReactNode;
  renderTail: (m: Mats) => React.ReactNode;
  renderEars: (m: Mats, p: Pose) => React.ReactNode;
  renderBehindHead: (m: Mats, p: Pose) => React.ReactNode;
};

/** Part of a sphere between polar angles (0 = top, π = bottom). */
const band = (t0: number, t1: number) => new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, t0 * Math.PI, (t1 - t0) * Math.PI);
const shirtTop = band(0.08, 0.6);
const pantsLow = band(0.55, 1);
const skirt = new THREE.CylinderGeometry(0.52, 0.66, 0.42, 48, 1, true);
const collar = new THREE.TorusGeometry(0.3, 0.06, 12, 40);
const strap = new THREE.TorusGeometry(0.5, 0.035, 8, 40, Math.PI * 0.5);

const Shell: React.FC<{ g: THREE.BufferGeometry; m: THREE.Material; r: number; s: [number, number, number]; p: [number, number, number] }> = ({ g, m, r, s, p }) => (
  <mesh geometry={g} material={m} position={p} scale={[r * s[0], r * s[1], r * s[2]]} castShadow receiveShadow />
);

// Body sphere: radius 0.5, stretch [1, 1.1, 0.9], centre y 0.25 (in hip space).
const BODY: [number, number, number] = [1, 1.1, 0.9];

export const SPECIES: Record<"bubu" | "lulu" | "toto", Species> = {
  bubu: {
    name: "Bubu the Bear",
    fur: "#9a6236", furLight: "#e9c497", inner: "#e7a08d", nose: "#3b2116", iris: "#5a3518", cheek: "#ff8d8d", brow: "#5b3519",
    outfitA: "#e8423b", outfitB: "#ffc83d", accent: "#ffffff", sleeves: true, pants: false,
    renderOutfit: (m) => (
      <>
        {/* red t-shirt */}
        <Shell g={shirtTop} m={m.outfitA} r={0.515} s={BODY} p={[0, 0.25, 0]} />
        {/* yellow dungarees: shorts, bib and straps with buttons */}
        <Shell g={pantsLow} m={m.outfitB} r={0.52} s={BODY} p={[0, 0.25, 0]} />
        <mesh geometry={sphere} material={m.outfitB} position={[0, 0.27, 0.36]} scale={[0.26, 0.2, 0.12]} castShadow />
        <mesh geometry={strap} material={m.outfitB} position={[-0.02, 0.1, 0]} rotation={[0, 0, Math.PI * 0.42]} scale={[0.9, 1.15, 1]} />
        <mesh geometry={strap} material={m.outfitB} position={[0.02, 0.1, 0]} rotation={[0, Math.PI, Math.PI * 0.42]} scale={[0.9, 1.15, 1]} />
        <Ball m={m.accent} r={0.035} p={[-0.14, 0.34, 0.45]} />
        <Ball m={m.accent} r={0.035} p={[0.14, 0.34, 0.45]} />
      </>
    ),
    renderTail: (m) => <Ball m={m.fur} r={0.11} p={[0, 0.0, -0.45]} />,
    renderBehindHead: () => null,
    renderEars: (m, p) => (
      <>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.4, 0.86, -0.02]} rotation={[0, 0, side * (-0.3 - p.earFlop * 0.15)]}>
            <Ball m={m.fur} r={0.17} s={[1, 1, 0.7]} />
            <Ball m={m.inner} r={0.1} s={[1, 1, 0.5]} p={[0, 0, 0.07]} shadow={false} />
          </group>
        ))}
      </>
    ),
  },
  lulu: {
    name: "Lulu the Bunny",
    fur: "#f6f1ec", furLight: "#ffffff", inner: "#f7a9c0", nose: "#ff8fb1", iris: "#2f74d0", cheek: "#ff7aa8", brow: "#d6c9c0",
    outfitA: "#4aa3ff", outfitB: "#ff8fc0", accent: "#ff8fc0", sleeves: false, pants: false,
    renderOutfit: (m) => (
      <>
        {/* blue dress with a flared skirt and pink collar */}
        <Shell g={shirtTop} m={m.outfitA} r={0.515} s={BODY} p={[0, 0.25, 0]} />
        <mesh geometry={skirt} material={m.outfitA} position={[0, 0.02, 0]} castShadow receiveShadow />
        <mesh geometry={collar} material={m.outfitB} position={[0, 0.66, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
        {[-0.18, 0, 0.18].map((x) => (
          <Ball key={x} m={m.outfitB} r={0.045} p={[x, -0.12, 0.6]} />
        ))}
      </>
    ),
    renderTail: (m) => <Ball m={m.light} r={0.15} p={[0, -0.02, -0.46]} />,
    renderBehindHead: () => null,
    renderEars: (m, p) => (
      <>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.2, 0.88, -0.05]} rotation={[-0.15 - p.earFlop * 0.5, 0, side * (-0.22 - p.earFlop * 0.12)]}>
            <group position={[0, 0.34, 0]} rotation={[0, 0, side * 0.08]}>
              <mesh geometry={capsule} material={m.fur} scale={[0.11, 0.17, 0.07]} castShadow />
              <mesh geometry={capsule} material={m.inner} position={[0, 0, 0.045]} scale={[0.065, 0.14, 0.03]} />
            </group>
          </group>
        ))}
        {/* pink bow */}
        <group position={[0.24, 0.92, 0.12]} rotation={[0, 0, 0.3]}>
          <Ball m={m.outfitB} r={0.08} s={[1.2, 0.8, 0.5]} p={[-0.08, 0, 0]} />
          <Ball m={m.outfitB} r={0.08} s={[1.2, 0.8, 0.5]} p={[0.08, 0, 0]} />
          <Ball m={m.accent} r={0.04} />
        </group>
      </>
    ),
  },
  toto: {
    name: "Toto the Lion",
    fur: "#f0b14a", furLight: "#ffe2a6", inner: "#d98a3a", nose: "#6b3a1f", iris: "#7a4e12", cheek: "#ff9a7a", brow: "#b8662a",
    mane: "#e8762c", outfitA: "#3fae4f", outfitB: "#2a7d38", accent: "#ffe066", sleeves: true, pants: true,
    renderOutfit: (m) => (
      <>
        {/* green t-shirt with a yellow star, dark-green shorts */}
        <Shell g={shirtTop} m={m.outfitA} r={0.515} s={BODY} p={[0, 0.25, 0]} />
        <Shell g={pantsLow} m={m.outfitB} r={0.52} s={BODY} p={[0, 0.25, 0]} />
        <group position={[0, 0.33, 0.45]} rotation={[-0.2, 0, 0]}>
          {[0, 1, 2, 3, 4].map((k) => (
            <Ball key={k} m={m.accent} r={0.045} s={[0.6, 1.6, 0.4]} p={[Math.sin((k * 2 * Math.PI) / 5) * 0.05, Math.cos((k * 2 * Math.PI) / 5) * 0.05, 0]} rot={[0, 0, (-k * 2 * Math.PI) / 5]} />
          ))}
        </group>
      </>
    ),
    renderTail: (m) => (
      <group position={[0, 0.02, -0.42]} rotation={[-0.9, 0, 0]}>
        <mesh geometry={capsule} material={m.fur} position={[0, -0.2, 0]} scale={[0.045, 0.1, 0.045]} castShadow />
        <Ball m={m.mane} r={0.09} p={[0, -0.4, 0]} />
      </group>
    ),
    renderBehindHead: (m) => (
      <group position={[0, 0.42, -0.08]}>
        {/* soft rounded mane: a ring of fluffy lobes */}
        {Array.from({ length: 14 }).map((_, k) => {
          const a = (k / 14) * Math.PI * 2;
          return <Ball key={k} m={m.mane} r={0.22} s={[1, 1, 0.75]} p={[Math.cos(a) * 0.56, Math.sin(a) * 0.52, -0.02]} />;
        })}
        <Ball m={m.mane} r={0.58} s={[1.1, 1.05, 0.55]} p={[0, 0, -0.12]} />
      </group>
    ),
    renderEars: (m) => (
      <>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.38, 0.86, 0.02]}>
            <Ball m={m.fur} r={0.13} s={[1, 1, 0.7]} />
            <Ball m={m.inner} r={0.075} s={[1, 1, 0.5]} p={[0, 0, 0.06]} shadow={false} />
          </group>
        ))}
      </>
    ),
  },
};
