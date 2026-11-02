import React, { useMemo } from "react";
import * as THREE from "three";

export type Blip = { x: number; y: number; on: number }; // position in scope units (-1..1), visibility 0..1

/**
 * Analog PPI radar scope: green phosphor, range rings, rotating sweep with afterglow.
 * Blips light up when the sweep passes and then decay — like a real long-persistence CRT.
 */
export const RadarScope: React.FC<{ t: number; blips: Blip[]; radius?: number; noise?: number; power?: number }> = ({ t, blips, radius = 0.32, noise = 0.25, power = 1 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uB: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) }, uN: { value: 0 }, uP: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform float uT; uniform vec3 uB[8]; uniform float uN; uniform float uP; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
          void main(){
            vec2 p = vUv*2.0 - 1.0; float r = length(p);
            if (r > 1.0) { gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
            float sweepA = mod(uT*1.6, 6.28318);
            float a = atan(p.y, p.x); if (a < 0.0) a += 6.28318;
            float behind = mod(sweepA - a, 6.28318);
            float glow = exp(-behind*2.2);
            vec3 c = vec3(0.01,0.03,0.015);
            c += vec3(0.1,0.9,0.35) * glow * 0.22 * (0.6 + 0.4*h(floor(p*90.0) + floor(uT*8.0)));
            c += vec3(0.1,1.0,0.4) * exp(-behind*60.0) * 0.6;
            float rings = 0.0;
            for (int i = 1; i <= 4; i++) rings += exp(-pow((r - float(i)*0.25)/0.004, 2.0));
            rings += exp(-pow(p.x/0.003,2.0)) + exp(-pow(p.y/0.003,2.0));
            c += vec3(0.08,0.5,0.2) * rings * 0.35;
            for (int i = 0; i < 8; i++) {
              vec3 b = uB[i]; if (b.z <= 0.0) continue;
              float ba = atan(b.y, b.x); if (ba < 0.0) ba += 6.28318;
              float since = mod(sweepA - ba, 6.28318);
              float lit = exp(-since*0.55) * b.z;
              c += vec3(0.4,1.0,0.55) * exp(-dot(p-b.xy, p-b.xy)/0.0012) * lit * 1.6;
            }
            c += vec3(0.05,0.35,0.12) * (h(p*400.0 + uT) - 0.5) * uN;     // phosphor noise / interference
            c *= smoothstep(1.0, 0.92, r) * uP;
            c += vec3(0.02,0.06,0.03) * (1.0 - r) * uP;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  mat.uniforms.uT.value = t;
  mat.uniforms.uN.value = noise;
  mat.uniforms.uP.value = power;
  blips.slice(0, 8).forEach((b, i) => mat.uniforms.uB.value[i].set(b.x, b.y, b.on));
  for (let i = blips.length; i < 8; i++) mat.uniforms.uB.value[i].set(0, 0, 0);
  return (
    <mesh material={mat}>
      <circleGeometry args={[radius, 64]} />
    </mesh>
  );
};
