import { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { Mood } from "./World";

/** Reflection environment matching a mood: sky gradient over a dark sea, soft sun. */
export function useMoodEnv(mood: Mood) {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const scene = new THREE.Scene();
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(50, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          uniforms: { uSky: { value: new THREE.Color(mood.sky) }, uHor: { value: new THREE.Color(mood.horizon) }, uSun: { value: mood.sun.clone().normalize() }, uSunC: { value: new THREE.Color(mood.sunColor) } },
          vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
          fragmentShader: `uniform vec3 uSky; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunC; varying vec3 vD;
            void main(){ vec3 d = normalize(vD); vec3 c = mix(uHor, uSky, smoothstep(0.0, 0.6, d.y));
              c = mix(c, uHor*0.25, smoothstep(0.0, -0.3, d.y));
              float s = max(dot(d, uSun), 0.0); c += uSunC*(pow(s, 300.0)*8.0 + pow(s, 20.0)*0.4);
              gl_FragColor = vec4(c, 1.0); }`,
        }),
      ),
    );
    const pm = new THREE.PMREMGenerator(gl);
    const tex = pm.fromScene(scene, 0.03).texture;
    pm.dispose();
    return tex;
  }, [gl, mood]);
}

/** Deterministic lightning: brief double-flickers at the given times. */
export function lightning(t: number, times: number[]) {
  let f = 0;
  for (const s of times) {
    const d = t - s;
    if (d >= 0 && d < 0.6) f = Math.max(f, Math.exp(-d * 9) + (d > 0.12 ? Math.exp(-(d - 0.12) * 14) * 0.7 : 0));
  }
  return f;
}
