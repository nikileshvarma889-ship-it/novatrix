import React, { useMemo } from "react";
import * as THREE from "three";

/** Martin PBM Mariner flying boat (≈24 m long, 36 m span). +X forward. */
export const Mariner: React.FC<{ prop?: number; lights?: number; env?: THREE.Texture | null }> = ({ prop = 0, lights = 0, env = null }) => {
  const m = useMemo(() => {
    const paint = new THREE.MeshStandardMaterial({ color: "#26354f", roughness: 0.42, metalness: 0.25, envMap: env, envMapIntensity: 0.8 });
    const under = new THREE.MeshStandardMaterial({ color: "#8d949c", roughness: 0.5, metalness: 0.2, envMap: env, envMapIntensity: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: "#111317", roughness: 0.6, metalness: 0.5 });
    const glass = new THREE.MeshPhysicalMaterial({ color: "#0b1016", roughness: 0.05, metalness: 0.2, envMap: env, envMapIntensity: 1.5 });
    const blur = new THREE.MeshBasicMaterial({ color: "#20242a", transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
    const lamp = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    return { paint, under, dark, glass, blur, lamp };
  }, [env]);
  m.lamp.color.setRGB(1, 0.85 * lights + 0.1, 0.6 * lights + 0.1);
  const hull = useMemo(() => {
    const pts: [number, number][] = [[0.02, -13], [0.35, -12], [0.8, -9], [1.25, -5], [1.5, -1], [1.55, 3], [1.45, 6.5], [1.1, 9.5], [0.5, 11.3], [0.05, 11.8]];
    const g = new THREE.LatheGeometry(pts.map(([r, x]) => new THREE.Vector2(r, x)), 36);
    g.rotateZ(-Math.PI / 2);
    g.scale(1, 1.45, 1);
    return g;
  }, []);
  const wingPanel = (len: number, chord: number) => <boxGeometry args={[chord, 0.38, len]} />;
  return (
    <group>
      <mesh geometry={hull} material={m.paint} />
      <mesh material={m.under} position={[1, -1.55, 0]} scale={[20, 0.5, 2.2]}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh material={m.glass} position={[8.4, 1.25, 0]} scale={[1.6, 0.55, 1.05]}><sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      {/* gull wing: inner panels angle up, outer panels level */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <group position={[2.2, 2.3, 2.6 * s]} rotation={[s * -0.32, 0, 0]}>
            <mesh material={m.paint} position={[0, 0, 2.5 * s]}>{wingPanel(5.2, 4.2)}</mesh>
          </group>
          <group position={[2.2, 3.85, 0]}>
            <mesh material={m.paint} position={[0, 0, (5.2 + 6.5) * s]}>{wingPanel(13, 3.6)}</mesh>
            {/* engine nacelle + prop */}
            <group position={[1.4, -0.2, 5.0 * s]}>
              <mesh material={m.paint} rotation={[0, 0, -Math.PI / 2]}><cylinderGeometry args={[0.85, 0.75, 6.5, 24]} /></mesh>
              <mesh material={m.dark} position={[3.3, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><circleGeometry args={[0.8, 24]} /></mesh>
              <mesh material={m.blur} position={[3.45, 0, 0]} rotation={[0, Math.PI / 2, prop]}><circleGeometry args={[2.2, 40]} /></mesh>
              <mesh material={m.lamp} position={[-2.6, -0.5, 0]}><sphereGeometry args={[0.12, 8, 6]} /></mesh>
            </group>
            {/* wingtip float */}
            <group position={[0.3, -2.3, 17.5 * s]}>
              <mesh material={m.dark} position={[0, 1.1, 0]}><boxGeometry args={[0.2, 2.2, 0.2]} /></mesh>
              <mesh material={m.paint} rotation={[0, 0, -Math.PI / 2]} scale={[1, 1, 0.8]}><capsuleGeometry args={[0.45, 2.6, 8, 16]} /></mesh>
            </group>
          </group>
        </group>
      ))}
      {/* tail: dihedral stabiliser with twin canted fins */}
      <group position={[-11.4, 1.6, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} rotation={[s * -0.35, 0, 0]}>
            <mesh material={m.paint} position={[0, 0, 2.6 * s]}><boxGeometry args={[2.6, 0.18, 5.2]} /></mesh>
            <mesh material={m.paint} position={[-0.3, 1.2, 5.1 * s]} rotation={[s * 0.35, 0, 0]}><boxGeometry args={[2.4, 3.2, 0.16]} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
};
