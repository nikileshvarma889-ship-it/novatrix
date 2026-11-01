import React, { useMemo } from "react";
import * as THREE from "three";

/**
 * Longitudinal sound wave through a medium: molecules oscillate back and forth along the direction of travel,
 * creating golden compressions. mode "air": molecules present, the wave travels. mode "vacuum": the molecules
 * fade away, the source still vibrates but nothing carries the wave.
 */
export const Waves: React.FC<{ t: number; mode: "air" | "vacuum"; env: THREE.Texture }> = ({ t, mode, env }) => {
  const NX = 34, NY = 54, NZ = 3;
  const count = NX * NY * NZ;
  const { mesh, base, rnd } = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.075, 10, 8);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4, envMap: env, envMapIntensity: 1, transparent: true });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const base: number[] = [], rnd: number[] = [];
    let s = 12345;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < NX; i++)
      for (let j = 0; j < NY; j++)
        for (let k = 0; k < NZ; k++) {
          base.push((i - NX / 2) * 0.32 + (r() - 0.5) * 0.12, (j - NY / 2) * 0.32 + (r() - 0.5) * 0.12, (k - NZ / 2) * 0.4 + (r() - 0.5) * 0.12);
          rnd.push(r());
        }
    return { mesh, base, rnd };
  }, [count, env]);

  const src = new THREE.Vector3(0, -8.6, 0);
  const speed = 2.4, k = 2.6, omega = speed * k, amp = 0.16;
  const front = t * speed;
  const fade = mode === "vacuum" ? Math.max(0, 1 - t / 1.4) : Math.min(1, t / 0.6);
  const dummy = new THREE.Object3D();
  const cold = new THREE.Color("#5f7fb8"), hot = new THREE.Color("#ffc35a"), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
    const dx = x - src.x, dy = y - src.y, dz = z - src.z;
    const r = Math.hypot(dx, dy, dz);
    let disp = 0, dens = 0;
    if (mode === "air" && r < front) {
      const ph = k * r - omega * t;
      const att = Math.min(1, (front - r) / 1.2) / (1 + r * 0.04);
      disp = -amp * Math.sin(ph) * att;
      dens = Math.max(0, Math.cos(ph)) * att;
    }
    const jx = Math.sin(t * 1.3 + rnd[i] * 40) * 0.025, jy = Math.cos(t * 1.1 + rnd[i] * 70) * 0.025;   // thermal jiggle
    const vanish = mode === "vacuum" ? Math.max(0, Math.min(1, (1 - t / 1.4) + (rnd[i] - 0.5) * 0.6)) : 1;
    dummy.position.set(x + (dx / (r || 1)) * disp + jx, y + (dy / (r || 1)) * disp + jy, z);
    const sc = (0.8 + dens * 0.45) * vanish;
    dummy.scale.setScalar(Math.max(0.0001, sc));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    c.copy(cold).lerp(hot, Math.min(1, dens * 1.3));
    mesh.setColorAt(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  (mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, fade);
  (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color("#3a2a08");

  // the vibrating source: a polished gold bell/diaphragm
  const vib = Math.sin(t * omega * 1.0) * 0.06;
  return (
    <group>
      {fade > 0.001 ? <primitive object={mesh} /> : null}
      <group position={src}>
        <mesh scale={[1 + vib, 1 - vib * 0.6, 1 + vib]}>
          <sphereGeometry args={[0.9, 48, 32]} />
          <meshStandardMaterial color="#d6a443" metalness={1} roughness={0.18} envMap={env} envMapIntensity={1.6} emissive="#4a3005" />
        </mesh>
        <mesh position={[0, -0.75, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.6, 0.6, 32]} />
          <meshStandardMaterial color="#2b2f38" metalness={0.8} roughness={0.35} envMap={env} />
        </mesh>
        {/* in vacuum: a ripple that dies right at the source — nothing to carry it */}
        {mode === "vacuum" ? <Ripple t={t} /> : null}
      </group>
    </group>
  );
};

const Ripple: React.FC<{ t: number }> = ({ t }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uR: { value: 0 }, uA: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform float uR; uniform float uA;
          void main(){ float r = length(vUv-0.5)*2.0; float a = exp(-pow((r-uR)/0.03,2.0))*uA; gl_FragColor = vec4(vec3(1.0,0.78,0.4)*a, a); }`,
      }),
    [],
  );
  const p = (t * 1.6) % 1;
  mat.uniforms.uR.value = 0.32 + p * 0.25;
  mat.uniforms.uA.value = (1 - p) * (1 - p) * 0.8;
  return (
    <mesh material={mat}>
      <planeGeometry args={[6, 6]} />
    </mesh>
  );
};
