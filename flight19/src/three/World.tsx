import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { NOISE } from "./noise";

export type Mood = { sky: string; horizon: string; fog: string; sun: THREE.Vector3; sunColor: string; sunI: number; storm: number };

export const MOODS: Record<string, Mood> = {
  // afternoon, already hazy (graded blue-grey)
  day: { sky: "#5d6f84", horizon: "#a9b4bd", fog: "#8e9aa6", sun: new THREE.Vector3(-0.4, 0.55, 0.4), sunColor: "#fff1dc", sunI: 2.4, storm: 0.15 },
  // late afternoon over the ocean, weather building
  dusk: { sky: "#2f3c4d", horizon: "#77818a", fog: "#5f6a75", sun: new THREE.Vector3(-0.7, 0.18, 0.2), sunColor: "#ffd9a8", sunI: 1.6, storm: 0.55 },
  // storm at sunset, dense fog
  storm: { sky: "#1b232e", horizon: "#3c4652", fog: "#3a434d", sun: new THREE.Vector3(-0.8, 0.08, 0.3), sunColor: "#c9b49a", sunI: 0.8, storm: 1 },
  // night over the sea
  night: { sky: "#05080d", horizon: "#121a24", fog: "#0e141c", sun: new THREE.Vector3(0.3, 0.5, -0.6), sunColor: "#8fa6c8", sunI: 0.35, storm: 0.9 },
};

/** Sky dome: gradient + layered storm clouds + sun glow. */
export const SkyDome: React.FC<{ mood: Mood; t: number; flash?: number }> = ({ mood, t, flash = 0 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uSky: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunC: { value: new THREE.Color() }, uT: { value: 0 }, uStorm: { value: 0 }, uFlash: { value: 0 } },
        vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `${NOISE}
          uniform vec3 uSky; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunC; uniform float uT; uniform float uStorm; uniform float uFlash; varying vec3 vD;
          void main(){
            vec3 d = normalize(vD);
            float h = clamp(d.y, -0.2, 1.0);
            vec3 c = mix(uHor, uSky, smoothstep(-0.02, 0.45, h));
            float s = max(dot(d, normalize(uSun)), 0.0);
            c += uSunC * (pow(s, 12.0)*0.35 + pow(s, 200.0)*1.2) * (1.0 - uStorm*0.6);
            vec2 p = d.xz / max(d.y + 0.12, 0.05);
            float cl = fbm(vec3(p*0.35 + vec2(uT*0.01, 0.0), uT*0.02));
            float cl2 = fbm(vec3(p*1.1 - vec2(uT*0.02, 0.0), 3.0));
            float cov = smoothstep(0.42 - uStorm*0.18, 0.75, cl*0.75 + cl2*0.35);
            vec3 cloudC = mix(uHor*0.85, uSky*0.6, cl2) + uSunC*pow(s,6.0)*0.25*(1.0-cov);
            c = mix(c, cloudC, cov * smoothstep(-0.05, 0.12, d.y) * (0.6 + uStorm*0.4));
            c += vec3(0.75,0.82,1.0) * uFlash * (0.4 + cov*0.9);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  mat.uniforms.uSky.value.set(mood.sky);
  mat.uniforms.uHor.value.set(mood.horizon);
  mat.uniforms.uSun.value.copy(mood.sun);
  mat.uniforms.uSunC.value.set(mood.sunColor);
  mat.uniforms.uT.value = t;
  mat.uniforms.uStorm.value = mood.storm;
  mat.uniforms.uFlash.value = flash;
  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[4000, 48, 32]} />
    </mesh>
  );
};

/** Open ocean: travelling waves (vertex), fine ripples (normal noise), fresnel sky reflection, whitecaps, fog. */
export const Ocean: React.FC<{ mood: Mood; t: number; flash?: number; size?: number; y?: number; glow?: THREE.Vector3 | null; glowI?: number }> = ({ mood, t, flash = 0, size = 6000, y = 0, glow = null, glowI = 0 }) => {
  const cam = useThree((s) => s.camera);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uT: { value: 0 }, uSky: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() },
          uSunC: { value: new THREE.Color() }, uStorm: { value: 0 }, uFlash: { value: 0 }, uCam: { value: new THREE.Vector3() }, uGlow: { value: new THREE.Vector3() }, uGlowI: { value: 0 },
        },
        vertexShader: `uniform float uT; uniform float uStorm; varying vec3 vW; varying float vH;
          float wave(vec2 p, vec2 dir, float len, float amp, float spd){ float k = 6.2831/len; return amp*sin(dot(normalize(dir),p)*k - uT*spd*k); }
          void main(){
            vec3 p = position;
            vec4 w = modelMatrix*vec4(p,1.0);
            float a = 0.6 + uStorm*1.6;
            float h = wave(w.xz, vec2(1.0,0.3), 60.0, 0.9*a, 9.0) + wave(w.xz, vec2(0.6,-1.0), 31.0, 0.45*a, 7.0) + wave(w.xz, vec2(-0.4,1.0), 17.0, 0.25*a, 5.0) + wave(w.xz, vec2(1.0,1.0), 9.0, 0.12*a, 3.5);
            w.y += h; vH = h / a; vW = w.xyz;
            gl_Position = projectionMatrix*viewMatrix*w;
          }`,
        fragmentShader: `${NOISE}
          uniform float uT; uniform vec3 uSky; uniform vec3 uHor; uniform vec3 uFog; uniform vec3 uSun; uniform vec3 uSunC; uniform float uStorm; uniform float uFlash; uniform vec3 uCam; uniform vec3 uGlow; uniform float uGlowI;
          varying vec3 vW; varying float vH;
          void main(){
            vec2 q = vW.xz;
            float e = 0.6;
            float n0 = fbm(vec3(q*0.06, uT*0.15));
            float nx = fbm(vec3((q+vec2(e,0.0))*0.06, uT*0.15)) - n0;
            float nz = fbm(vec3((q+vec2(0.0,e))*0.06, uT*0.15)) - n0;
            vec3 n = normalize(vec3(-nx*5.0*(1.0+uStorm), 1.0, -nz*5.0*(1.0+uStorm)));
            vec3 v = normalize(uCam - vW);
            float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0)*0.85 + 0.04;
            vec3 r = reflect(-v, n);
            vec3 skyR = mix(uHor, uSky, smoothstep(0.0, 0.5, r.y));
            vec3 deep = mix(vec3(0.02,0.045,0.06), uFog*0.35, 0.25);
            vec3 c = mix(deep, skyR, fres);
            float spec = pow(max(dot(r, normalize(uSun)), 0.0), 120.0);
            c += uSunC * spec * (1.0 - uStorm*0.5) * 1.4;
            float foam = smoothstep(0.55, 0.95, vH*0.6 + fbm(vec3(q*0.25, uT*0.3))*0.7) * uStorm;
            c = mix(c, vec3(0.62,0.66,0.7)*(0.4+uFlash), foam*0.55);
            c += vec3(0.7,0.78,0.9) * uFlash * fres * 1.5;
            if (uGlowI > 0.0) { float gd = length(vW.xz - uGlow.xz); c += vec3(1.0,0.45,0.12) * uGlowI * exp(-gd*0.02) * (0.3 + fres); }
            float dist = length(uCam - vW);
            float f = 1.0 - exp(-pow(dist*0.0009*(1.0+uStorm*1.6), 1.3));
            c = mix(c, uFog, clamp(f, 0.0, 1.0));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  const u = mat.uniforms;
  u.uT.value = t; u.uSky.value.set(mood.sky); u.uHor.value.set(mood.horizon); u.uFog.value.set(mood.fog); u.uSun.value.copy(mood.sun);
  u.uSunC.value.set(mood.sunColor); u.uStorm.value = mood.storm; u.uFlash.value = flash; u.uCam.value.copy(cam.position);
  if (glow) u.uGlow.value.copy(glow);
  u.uGlowI.value = glowI;
  return (
    <mesh material={mat} position={[cam.position.x, y, cam.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size, 220, 220]} />
    </mesh>
  );
};

/** Soft cloud / fog banks: camera-facing billboards with animated fbm, depth-faded into the fog. */
export const CloudLayer: React.FC<{ mood: Mood; t: number; count?: number; seed?: number; area?: [number, number, number]; center?: [number, number, number]; size?: [number, number]; opacity?: number; flash?: number; drift?: [number, number, number] }> = ({
  mood, t, count = 40, seed = 1, area = [2000, 120, 2000], center = [0, 300, 0], size = [260, 520], opacity = 0.75, flash = 0, drift = [0, 0, 0],
}) => {
  const items = useMemo(() => {
    let s = seed * 104729 + 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: count }, () => ({
      p: [center[0] + (r() - 0.5) * area[0], center[1] + (r() - 0.5) * area[1], center[2] + (r() - 0.5) * area[2]] as [number, number, number],
      w: size[0] + r() * (size[1] - size[0]), seed: r() * 100, rot: r() * 6.28,
    }));
  }, [count, seed, area[0], area[1], area[2], center[0], center[1], center[2], size[0], size[1]]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uT: { value: 0 }, uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uA: { value: 1 }, uSeed: { value: 0 }, uFlash: { value: 0 } },
        vertexShader: `varying vec2 vUv; varying float vDepth; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(0.0,0.0,0.0,1.0); mv.xy += position.xy; vDepth = -mv.z; gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `${NOISE}
          uniform float uT; uniform vec3 uC1; uniform vec3 uC2; uniform float uA; uniform float uSeed; uniform float uFlash; varying vec2 vUv; varying float vDepth;
          void main(){
            vec2 p = vUv - 0.5;
            float n = fbm(vec3(p*3.0 + uSeed, uT*0.03 + uSeed));
            float d = 1.0 - smoothstep(0.15, 0.5, length(p*vec2(1.0,1.6)) + (n-0.5)*0.35);
            float a = d * smoothstep(0.25, 0.7, n + d*0.3) * uA;
            a *= smoothstep(4.0, 60.0, vDepth);               // fade when the camera flies through
            vec3 c = mix(uC2, uC1, smoothstep(0.2, 0.8, n + p.y)) + vec3(0.7,0.8,1.0)*uFlash*0.8;
            gl_FragColor = vec4(c, a);
          }`,
      }),
    [],
  );
  const mats = useMemo(() => items.map(() => mat.clone()), [items, mat]);
  return (
    <group>
      {items.map((it, i) => {
        const m = mats[i];
        m.uniforms.uT.value = t; m.uniforms.uSeed.value = it.seed; m.uniforms.uA.value = opacity; m.uniforms.uFlash.value = flash;
        m.uniforms.uC1.value.set(mood.horizon); m.uniforms.uC2.value.set(mood.fog).multiplyScalar(0.75);
        return (
          <mesh key={i} material={m} position={[it.p[0] + drift[0] * t, it.p[1] + drift[1] * t, it.p[2] + drift[2] * t]} renderOrder={1}>
            <planeGeometry args={[it.w, it.w * 0.55]} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Scene fog matching the mood (applies to standard materials: aircraft, buildings). */
export const MoodFog: React.FC<{ mood: Mood; density: number }> = ({ mood, density }) => <fogExp2 attach="fog" args={[mood.fog, density]} />;
