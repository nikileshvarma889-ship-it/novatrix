import React, { useMemo } from "react";
import * as THREE from "three";

let _glow: THREE.Texture | null = null;
/** Soft radial light texture (bright core, wide halo) shared by every light sprite. */
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.08, "rgba(255,255,255,0.95)");
  g.addColorStop(0.2, "rgba(255,255,255,0.35)");
  g.addColorStop(0.5, "rgba(255,255,255,0.08)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

let _pt: THREE.Texture | null = null;
/** Small-light texture for point fields: a solid core so tiny points still read as lamps. */
function pointTexture() {
  if (_pt) return _pt;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.28, "rgba(255,255,255,0.95)");
  g.addColorStop(0.5, "rgba(255,255,255,0.3)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  _pt = new THREE.CanvasTexture(c);
  return _pt;
}

/** Additive light sprite (a lamp seen at night): world-size `size`, brightness `intensity` 0..1+. */
export const Glow: React.FC<{ pos: [number, number, number]; color: string; size: number; intensity: number; fog?: boolean }> = ({ pos, color, size, intensity, fog = false }) => {
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog, toneMapped: false }), [fog]);
  mat.color.set(color);
  mat.opacity = Math.max(0, Math.min(1, intensity));
  if (intensity <= 0.001) return null;
  return <sprite material={mat} position={pos} scale={[size, size, 1]} renderOrder={5} />;
};

/** Many identical lights in one draw call (runway / taxiway / city lights), never smaller than minPx on screen. */
export const LightField: React.FC<{ points: [number, number, number][]; color: string; size: number; intensity?: number; minPx?: number; twinkle?: number; t?: number }> = ({ points, color, size, intensity = 1, minPx = 3, twinkle = 0, t = 0 }) => {
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
    geo.setAttribute("seed", new THREE.Float32BufferAttribute(points.map((_, i) => (Math.sin(i * 91.7) * 43758.5) % 1), 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uMap: { value: pointTexture() }, uC: { value: new THREE.Color() }, uSize: { value: size }, uMin: { value: minPx }, uI: { value: 1 }, uScale: { value: 2600 }, uT: { value: 0 }, uTw: { value: 0 } },
      vertexShader: `attribute float seed; uniform float uSize; uniform float uMin; uniform float uScale; uniform float uT; uniform float uTw; varying float vA;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); float px = uSize*uScale/max(0.1,-mv.z);
          vA = clamp(0.55 + 0.45*px/uMin, 0.55, 1.0) * (1.0 - uTw*0.5*(0.5+0.5*sin(uT*7.0+seed*40.0)));
          gl_PointSize = max(uMin, px); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform vec3 uC; uniform float uI; varying float vA;
        void main(){ vec4 m = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uC * m.rgb, m.a * uI * vA); }`,
    });
    return { geo, mat };
  }, [points, size, minPx]);
  mat.uniforms.uC.value.set(color);
  mat.uniforms.uI.value = intensity;
  mat.uniforms.uT.value = t;
  mat.uniforms.uTw.value = twinkle;
  return <points geometry={geo} material={mat} renderOrder={4} />;
};
