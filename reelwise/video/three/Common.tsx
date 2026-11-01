import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useVideoConfig } from "remotion";

export type Mood = "bright" | "warm" | "night" | "dramatic" | "calm";

export const MOODS: Record<Mood, { top: string; horizon: string; sun: string; sunI: number; hemi: number; fog: string }> = {
  bright: { top: "#4aa8ff", horizon: "#dff1ff", sun: "#fff6e5", sunI: 2.4, hemi: 1.0, fog: "#dff1ff" },
  warm: { top: "#ff9a62", horizon: "#ffe1b8", sun: "#ffd29a", sunI: 2.2, hemi: 0.8, fog: "#ffe1c4" },
  calm: { top: "#86b8e8", horizon: "#eef4fb", sun: "#ffffff", sunI: 1.8, hemi: 1.0, fog: "#eef4fb" },
  dramatic: { top: "#1b2550", horizon: "#7a5ca8", sun: "#ffc6a0", sunI: 2.0, hemi: 0.5, fog: "#433c70" },
  night: { top: "#060b1f", horizon: "#20305e", sun: "#a9c4ff", sunI: 0.9, hemi: 0.35, fog: "#141d3c" },
};

export const sphere = new THREE.SphereGeometry(1, 32, 20);
export const box = new THREE.BoxGeometry(1, 1, 1);

export const Camera: React.FC<{ pos: [number, number, number]; target: [number, number, number]; fov?: number }> = ({ pos, target, fov = 40 }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...pos);
    camera.fov = fov;
    camera.near = 0.1;
    camera.far = 400;
    camera.updateProjectionMatrix();
    camera.lookAt(...target);
  }, [camera, pos, target, fov]);
  return null;
};

export const Sky: React.FC<{ mood: Mood }> = ({ mood }) => {
  const m = MOODS[mood];
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color(m.top) }, horizon: { value: new THREE.Color(m.horizon) } },
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: "uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y*1.5,0.0,1.0); gl_FragColor = vec4(mix(horizon, top, pow(h,0.7)), 1.0); }",
      }),
    [m.top, m.horizon],
  );
  return <mesh geometry={sphere} material={mat} scale={200} />;
};

export const Lights: React.FC<{ mood: Mood; accent: string }> = ({ mood, accent }) => {
  const m = MOODS[mood];
  return (
    <>
      <fog attach="fog" args={[m.fog, 25, 120]} />
      <hemisphereLight args={[m.horizon, "#5a6b5a", m.hemi]} />
      <directionalLight
        position={[8, 14, 10]}
        intensity={m.sunI}
        color={m.sun}
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <pointLight position={[-6, 4, 6]} intensity={mood === "night" ? 30 : 10} color={accent} distance={30} />
    </>
  );
};

/** A 3D canvas sized to the composition, with soft shadows and filmic tone mapping. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      shadows
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      {children}
    </ThreeCanvas>
  );
};
