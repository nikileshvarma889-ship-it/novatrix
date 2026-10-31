import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { rand } from "../lib/anim";

/** Celebration confetti that rains down from `start` (seconds). */
export const Confetti: React.FC<{ t: number; start: number }> = ({ t, start }) => {
  const n = 220;
  const ref = useRef<THREE.InstancedMesh>(null);
  const res = useMemo(() => {
    const palette = ["#ff4b6e", "#ffd23f", "#3fc1ff", "#7cdb5a", "#b47cff", "#ff9a3c"].map((c) => new THREE.Color(c));
    return { geo: new THREE.PlaneGeometry(0.08, 0.12), mat: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.5 }), palette };
  }, []);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const age = t - start;
    for (let i = 0; i < n; i++) {
      const delay = rand(i * 3.7) * 2.5;
      const a = age - delay;
      if (a < 0) {
        m.makeScale(0, 0, 0);
      } else {
        const x = (rand(i * 1.1) - 0.5) * 12 + Math.sin(a * 2 + i) * 0.3;
        const z = (rand(i * 2.3) - 0.5) * 6;
        const y = 7 - a * (1.1 + rand(i) * 0.6);
        e.set(a * (3 + rand(i * 5) * 4), a * 2 + i, a * 3);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(x, Math.max(y, 0.02), z), q, new THREE.Vector3(1, 1, 1));
      }
      ref.current!.setMatrixAt(i, m);
      ref.current!.setColorAt(i, res.palette[i % res.palette.length]);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [t, start, res]);
  if (t < start) return null;
  return <instancedMesh ref={ref} args={[res.geo, res.mat, n]} />;
};
