import React, { useMemo } from "react";
import * as THREE from "three";
import { Glow } from "./Lights";

/**
 * Generic ocean search vessel (~90 m), bow toward +X, waterline at y = 0.
 * Grey hull, white superstructure, mast lights, and a sweeping searchlight beam.
 */
export const Ship: React.FC<{ t: number; env?: THREE.Texture | null; beamYaw?: number; beam?: number }> = ({ t, env = null, beamYaw = 0, beam = 1 }) => {
  const hull = useMemo(() => {
    const s = new THREE.Shape();
    // side profile (x along length, y up): sheer line rising to the bow, flat stern
    s.moveTo(-45, -4); s.lineTo(38, -4); s.quadraticCurveTo(46, -3, 48, 7.5); s.lineTo(30, 6.4); s.lineTo(-45, 5.6); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 15, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.0, bevelSegments: 3, steps: 1 });
    g.translate(0, 0, -7.5);
    // pinch the bow so it narrows to a stem
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      if (x > 20) p.setZ(i, p.getZ(i) * Math.max(0.08, 1 - ((x - 20) / 28) ** 1.6));
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const m = useMemo(() => ({
    hull: new THREE.MeshStandardMaterial({ color: "#3c444c", roughness: 0.55, metalness: 0.4, envMap: env, envMapIntensity: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: "#5a1d1a", roughness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: "#c9ced3", roughness: 0.5, metalness: 0.2, envMap: env, envMapIntensity: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: "#111418", roughness: 0.6 }),
    win: new THREE.MeshBasicMaterial({ color: "#ffd59a", toneMapped: false }),
    beam: new THREE.MeshBasicMaterial({ color: "#dfe9ff", transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  }), [env]);
  const beamGeo = useMemo(() => { const g = new THREE.ConeGeometry(14, 160, 24, 1, true); g.translate(0, -80, 0); g.rotateZ(Math.PI / 2); return g; }, []);
  m.beam.opacity = 0.07 * beam;
  return (
    <group>
      <mesh geometry={hull} material={m.hull} />
      <mesh material={m.red} position={[0, -3.2, 0]}><boxGeometry args={[82, 1.6, 16.6]} /></mesh>
      {/* superstructure, bridge with lit windows, funnel, mast */}
      <mesh material={m.white} position={[-8, 10, 0]}><boxGeometry args={[30, 7, 13]} /></mesh>
      <mesh material={m.white} position={[-4, 15.5, 0]}><boxGeometry args={[16, 4.5, 14]} /></mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          {Array.from({ length: 7 }, (_, i) => <mesh key={i} material={m.win} position={[-10 + i * 2, 16, s * 7.05]}><planeGeometry args={[1.2, 1.2]} /></mesh>)}
        </group>
      ))}
      {Array.from({ length: 6 }, (_, i) => <mesh key={i} material={m.win} position={[4.05, 16, -5 + i * 2]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[1.2, 1.2]} /></mesh>)}
      <mesh material={m.dark} position={[-18, 16, 0]}><boxGeometry args={[5, 9, 5]} /></mesh>
      <mesh material={m.white} position={[-2, 23, 0]}><cylinderGeometry args={[0.35, 0.5, 11, 8]} /></mesh>
      <mesh material={m.white} position={[-2, 26.5, 0]}><boxGeometry args={[0.4, 0.4, 7]} /></mesh>
      <mesh material={m.dark} position={[-36, 7.5, 0]}><boxGeometry args={[14, 1, 13]} /></mesh>
      {/* lights: masthead, sidelights, stern */}
      <Glow pos={[-2, 28.8, 0]} color="#fff6e0" size={5} intensity={0.9} />
      <Glow pos={[2, 17.8, 7.4]} color="#26ff6a" size={3} intensity={0.85} />
      <Glow pos={[2, 17.8, -7.4]} color="#ff2a1f" size={3} intensity={0.85} />
      <Glow pos={[-45.5, 7, 0]} color="#fff6e0" size={3} intensity={0.7} />
      {/* searchlight on the bridge roof */}
      <group position={[3, 18.6, 0]} rotation={[0, beamYaw, -0.18]}>
        <Glow pos={[0, 0, 0]} color="#f2f6ff" size={9 * beam} intensity={beam} />
        <mesh geometry={beamGeo} material={m.beam} />
      </group>
    </group>
  );
};
