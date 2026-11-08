import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { CamSpec } from "../sim";

export const Cam: React.FC<{ c: CamSpec }> = ({ c }) => {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  cam.position.set(...c.pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(...c.look);
  if (cam.fov !== c.fov || cam.far !== 20000) { cam.fov = c.fov; cam.near = 0.05; cam.far = 20000; cam.updateProjectionMatrix(); }
  return null;
};

/** Dark photo-studio reflection environment: black room, warm softbox top-left, cool strip light behind. */
export function useStudioEnv(warm = "#ffb27a", cool = "#7fa6ff") {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#020203");
    const box = (pos: THREE.Vector3Tuple, size: THREE.Vector3Tuple, color: string, i: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(i), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); scene.add(m);
    };
    box([-6, 8, 5], [6, 4, 1], warm, 3.2);
    box([7, 3, -6], [1.2, 9, 1], cool, 2.2);
    box([0, -6, 0], [30, 30, 1], "#0b0a0a", 1);
    const pm = new THREE.PMREMGenerator(gl);
    const tex = pm.fromScene(scene, 0.02).texture;
    pm.dispose();
    return tex;
  }, [gl, warm, cool]);
}

/** Dark slate tabletop with a soft contact shadow under the subject. */
export const Table: React.FC<{ env: THREE.Texture; size?: number; shadow?: [number, number, number, number]; color?: string }> = ({ env, size = 400, shadow, color = "#141313" }) => {
  const { mat, shadowTex } = useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const x = c.getContext("2d")!;
    x.fillStyle = "#808080"; x.fillRect(0, 0, 512, 512);
    const r = (() => { let s = 5; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < 9000; i++) { const v = 100 + r() * 60; x.fillStyle = `rgba(${v},${v},${v},0.25)`; x.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3); }
    const rough = new THREE.CanvasTexture(c); rough.wrapS = rough.wrapT = THREE.RepeatWrapping; rough.repeat.set(size / 25, size / 25);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.1, roughnessMap: rough, envMap: env, envMapIntensity: 0.55 });
    const s = document.createElement("canvas"); s.width = s.height = 128;
    const y = s.getContext("2d")!;
    const g = y.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,0.85)"); g.addColorStop(0.5, "rgba(0,0,0,0.4)"); g.addColorStop(1, "rgba(0,0,0,0)");
    y.fillStyle = g; y.fillRect(0, 0, 128, 128);
    return { mat, shadowTex: new THREE.CanvasTexture(s) };
  }, [env, size, color]);
  return (
    <>
      <mesh material={mat} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[size, size]} /></mesh>
      {shadow ? (
        <mesh position={[shadow[0], 0.01, shadow[1]]} rotation={[-Math.PI / 2, 0, shadow[3]]}>
          <planeGeometry args={[shadow[2], shadow[2] * 0.45]} />
          <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
        </mesh>
      ) : null}
    </>
  );
};

/** Bright diagram arrow (shaft + head) along local +Y, base at the origin. */
export const Arrow: React.FC<{ len: number; r: number; color: string; opacity?: number; position?: THREE.Vector3Tuple; dir?: THREE.Vector3Tuple }> = ({ len, r, color, opacity = 1, position = [0, 0, 0], dir = [0, 1, 0] }) => {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()), [dir[0], dir[1], dir[2]]);
  if (len <= 0.01 || opacity <= 0.01) return null;
  const head = Math.min(len * 0.45, r * 4.5);
  return (
    <group position={position} quaternion={q}>
      <mesh position={[0, (len - head) / 2, 0]} renderOrder={8}>
        <cylinderGeometry args={[r, r, Math.max(0.001, len - head), 14]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} depthTest={false} />
      </mesh>
      <mesh position={[0, len - head / 2, 0]} renderOrder={8}>
        <coneGeometry args={[r * 2.6, head, 18]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} depthTest={false} />
      </mesh>
    </group>
  );
};

/** Curved arrow around the Z axis (counter-clockwise) for rotation. */
export const CurvedArrow: React.FC<{ radius: number; tube: number; arc: number; start: number; color: string; opacity?: number; position?: THREE.Vector3Tuple }> = ({ radius, tube, arc, start, color, opacity = 1, position = [0, 0, 0] }) => {
  if (opacity <= 0.01 || arc <= 0.01) return null;
  const end = start + arc;
  const head = tube * 5;
  return (
    <group position={position}>
      <mesh rotation={[0, 0, start]} renderOrder={8}>
        <torusGeometry args={[radius, tube, 10, 64, arc]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} depthTest={false} />
      </mesh>
      <mesh position={[Math.cos(end) * radius, Math.sin(end) * radius, 0]} rotation={[0, 0, end]} renderOrder={8}>
        <coneGeometry args={[tube * 2.8, head, 18]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} depthTest={false} />
      </mesh>
    </group>
  );
};

/** Night sky dome: deep blue horizon glow, black zenith, optional warm flash from fireworks. */
export const NightSky: React.FC<{ flash?: [number, number, number]; horizon?: string; radius?: number }> = ({ flash = [0, 0, 0], horizon = "#1b2140", radius = 9000 }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uHor: { value: new THREE.Color(horizon) }, uFlash: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uHor; uniform vec3 uFlash; varying vec3 vD;
      void main(){ float h = max(vD.y, 0.0); vec3 c = mix(uHor, vec3(0.006,0.008,0.02), smoothstep(0.0, 0.55, h));
        c += vec3(0.16,0.09,0.05) * exp(-h*14.0) * 0.6; c += uFlash * (0.4 + 0.6*smoothstep(0.0,0.5,h));
        if (vD.y < 0.0) c = uHor*0.15; gl_FragColor = vec4(c, 1.0); }`,
  }), [horizon]);
  mat.uniforms.uFlash.value.set(...flash);
  return <mesh material={mat} renderOrder={-10}><sphereGeometry args={[radius, 32, 16]} /></mesh>;
};
