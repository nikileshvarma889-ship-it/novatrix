import React, { useMemo } from "react";
import * as THREE from "three";
import { NOISE } from "./noise";

/** A silent explosion in vacuum. t = seconds since detonation (negative = not yet). */
export const Explosion: React.FC<{ t: number; scale?: number; seed?: number }> = ({ t, scale = 1, seed = 3 }) => {
  const fireMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uT: { value: 0 }, uFade: { value: 1 } },
        vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV;
          void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `${NOISE}
          varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uT; uniform float uFade;
          void main(){
            float n = fbm(normalize(vP)*3.0 + vec3(uT*0.35));
            float facing = pow(max(dot(vN, vV), 0.0), 1.4);
            float heat = clamp(facing*1.15 + n*0.55 - uT*0.12, 0.0, 1.2);
            vec3 c = mix(vec3(0.35,0.06,0.02), vec3(1.0,0.45,0.08), smoothstep(0.15,0.55,heat));
            c = mix(c, vec3(1.0,0.82,0.45), smoothstep(0.55,0.85,heat));
            c = mix(c, vec3(1.0,0.93,0.78), smoothstep(0.92,1.15,heat));
            float a = smoothstep(0.05, 0.6, n + facing*0.6) * uFade;
            gl_FragColor = vec4(c*a*0.95, a);
          }`,
      }),
    [],
  );
  const ringMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uA: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform float uA;
          void main(){ float r = length(vUv-0.5)*2.0; float a = exp(-pow((r-0.92)/0.05,2.0)) + 0.25*exp(-pow((r-0.8)/0.12,2.0));
            gl_FragColor = vec4(vec3(1.0,0.78,0.45)*a*uA, a*uA); }`,
      }),
    [],
  );
  const glowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uA: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(0.0,0.0,0.0,1.0); mv.xy += position.xy; gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `varying vec2 vUv; uniform float uA;
          void main(){ float r = length(vUv-0.5)*2.0; float a = exp(-r*r*5.0)*0.9 + exp(-r*24.0)*1.5; gl_FragColor = vec4(vec3(1.0,0.72,0.38)*a*uA, a*uA); }`,
      }),
    [],
  );
  const debris = useMemo(() => {
    let s = seed * 7919;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const n = 900;
    const vel = new Float32Array(n * 3), pos = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u), sp = 0.6 + Math.pow(rnd(), 2) * 3.2;
      vel.set([q * Math.cos(th) * sp, u * sp, q * Math.sin(th) * sp], i * 3);
      size[i] = 1.5 + rnd() * 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uA: { value: 1 } },
      vertexShader: `attribute float size; uniform float uA; varying float vA; void main(){ vA = uA; gl_PointSize = size; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying float vA; void main(){ vec2 p = gl_PointCoord*2.0-1.0; float r = dot(p,p); if(r>1.0) discard; gl_FragColor = vec4(vec3(1.0,0.75,0.4)*exp(-r*3.0)*vA, 1.0); }`,
    });
    return { g, vel, pos, mat };
  }, [seed]);

  if (t < 0) return null;
  // Vacuum physics: debris keeps its velocity (no drag), the fireball expands and thins without rising.
  for (let i = 0; i < debris.pos.length; i++) debris.pos[i] = debris.vel[i] * t;
  (debris.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  debris.mat.uniforms.uA.value = Math.max(0, 1 - t / 7);
  const r = 1.6 * (1 - Math.exp(-t * 1.6)) + 0.25 * t;
  fireMat.uniforms.uT.value = t;
  fireMat.uniforms.uFade.value = Math.max(0, Math.min(1, t * 8) * (1 - t / 6.5));
  ringMat.uniforms.uA.value = Math.max(0, 1 - t / 2.8);
  const flash = Math.exp(-t * 2.2);
  glowMat.uniforms.uA.value = 0.25 + flash * 1.0;
  return (
    <group scale={scale}>
      <mesh material={fireMat} scale={r}><icosahedronGeometry args={[1, 5]} /></mesh>
      <mesh material={fireMat} scale={r * 0.72} rotation={[1, 2, 0]}><icosahedronGeometry args={[1, 4]} /></mesh>
      <mesh material={ringMat} scale={0.3 + t * 2.4} rotation={[1.3, 0.3, 0]}><planeGeometry args={[2, 2]} /></mesh>
      <mesh material={glowMat}><planeGeometry args={[6 + flash * 10, 6 + flash * 10]} /></mesh>
      <points geometry={debris.g} material={debris.mat} />
      <pointLight color="#ffb46a" intensity={(4 + flash * 60) * scale} distance={0} decay={0.6} />
    </group>
  );
};
