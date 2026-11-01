import { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

/** A small reflection environment that looks like space: dark gradient, a warm sun, a faint blue Earth glow. */
export function useSpaceEnv(sunDir = new THREE.Vector3(1, 0.4, 0.6), warm = 1, boomDir = new THREE.Vector3(0, 0, 1), boom = 0) {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const scene = new THREE.Scene();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { uSun: { value: sunDir.clone().normalize() }, uWarm: { value: warm }, uBoom: { value: boomDir.clone().normalize() }, uBoomI: { value: boom } },
        vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vD; uniform vec3 uSun; uniform float uWarm; uniform vec3 uBoom; uniform float uBoomI;
          void main(){ vec3 d = normalize(vD);
            vec3 c = vec3(0.01,0.015,0.03);
            c += vec3(0.05,0.12,0.30) * smoothstep(0.2,-0.9,d.y);              // Earth-glow from below
            float s = max(dot(d,uSun),0.0);
            c += vec3(1.0,0.86,0.62) * (pow(s,900.0)*60.0 + pow(s,40.0)*1.2) * uWarm;
            float b = max(dot(d,uBoom),0.0); c += vec3(1.0,0.55,0.18) * (pow(b,30.0)*6.0 + pow(b,6.0)*0.8) * uBoomI;
            gl_FragColor = vec4(c,1.0); }`,
      }),
    );
    scene.add(sky);
    const pm = new THREE.PMREMGenerator(gl);
    const tex = pm.fromScene(scene, 0.02).texture;
    pm.dispose();
    return tex;
  }, [gl, sunDir.x, sunDir.y, sunDir.z, warm, boomDir.x, boomDir.y, boomDir.z, boom]);
}

/** Subtle woven-fabric bump texture made on a canvas (no external assets). */
export function useFabricBump() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    const img = x.createImageData(256, 256);
    for (let i = 0; i < 256; i++)
      for (let j = 0; j < 256; j++) {
        const weave = (Math.sin(i * 0.9) * Math.sin(j * 0.9) + 1) * 40;
        const v = 110 + weave + (((i * 7919 + j * 104729) % 97) / 97) * 50;
        const o = (i * 256 + j) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
        img.data[o + 3] = 255;
      }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    return t;
  }, []);
}
