import React, { useMemo } from "react";
import * as THREE from "three";

/** Per-frame particle buffers. Fill with push(); draw with <Sprites data={...} />. */
export class PBuf {
  pos: Float32Array; col: Float32Array; alpha: Float32Array; size: Float32Array; n = 0;
  constructor(public cap: number) {
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.alpha = new Float32Array(cap); this.size = new Float32Array(cap);
  }
  push(x: number, y: number, z: number, r: number, g: number, b: number, a: number, s: number) {
    if (this.n >= this.cap || a <= 0.003) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.alpha[i] = a; this.size[i] = s;
  }
}

const texCache: Record<string, THREE.Texture> = {};
function tex(kind: "glow" | "smoke" | "spark") {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  if (kind === "smoke") {
    // soft lumpy puff
    const r = (() => { let s = 9; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < 26; i++) {
      const cx = 64 + (r() - 0.5) * 50, cy = 64 + (r() - 0.5) * 50, rad = 18 + r() * 26;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, "rgba(255,255,255,0.22)"); g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    const m = x.createRadialGradient(64, 64, 20, 64, 64, 64);
    m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(1, "rgba(0,0,0,1)");
    x.globalCompositeOperation = "destination-out"; x.fillStyle = m; x.fillRect(0, 0, 128, 128);
  } else {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    if (kind === "spark") { g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(255,255,255,0.8)"); g.addColorStop(0.5, "rgba(255,255,255,0.12)"); }
    else { g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.15, "rgba(255,255,255,0.7)"); g.addColorStop(0.45, "rgba(255,255,255,0.15)"); }
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  }
  texCache[kind] = new THREE.CanvasTexture(c);
  return texCache[kind];
}

/** Camera-facing particles sized in world units (never below minPx). */
export const Sprites: React.FC<{ data: PBuf; blend?: "add" | "normal"; kind?: "glow" | "smoke" | "spark"; minPx?: number; order?: number }> = ({ data, blend = "add", kind = "glow", minPx = 1.5, order = 6 }) => {
  const { geo, mat } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(data.cap * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(data.cap * 3), 3));
    geo.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(data.cap), 1));
    geo.setAttribute("size", new THREE.BufferAttribute(new Float32Array(data.cap), 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: blend === "add" ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uMap: { value: tex(kind) }, uH: { value: 1920 }, uMin: { value: minPx } },
      vertexShader: `attribute vec3 color; attribute float alpha; attribute float size; uniform float uH; uniform float uMin; varying vec3 vC; varying float vA;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); float px = size*projectionMatrix[1][1]*uH*0.5/max(0.01,-mv.z);
          vC = color; vA = alpha * clamp(px/uMin, 0.0, 1.0); gl_PointSize = max(uMin, px); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; varying float vA;
        void main(){ vec4 m = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC*m.rgb, m.a*vA); }`,
    });
    return { geo, mat };
  }, [data.cap, blend, kind, minPx]);
  const n = data.n;
  (geo.attributes.position.array as Float32Array).set(data.pos.subarray(0, n * 3));
  (geo.attributes.color.array as Float32Array).set(data.col.subarray(0, n * 3));
  (geo.attributes.alpha.array as Float32Array).set(data.alpha.subarray(0, n));
  (geo.attributes.size.array as Float32Array).set(data.size.subarray(0, n));
  for (const k of ["position", "color", "alpha", "size"]) geo.attributes[k].needsUpdate = true;
  geo.setDrawRange(0, n);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return <points geometry={geo} material={mat} renderOrder={order} frustumCulled={false} />;
};

/** Fire colour ramp: temperature 1 = white-hot, 0.6 = yellow-orange, 0.3 = deep red, 0 = black. */
export function fire(T: number): [number, number, number] {
  const k = Math.max(0, Math.min(1.2, T));
  return [Math.min(1, k * 2.2), Math.min(1, Math.max(0, k * 1.7 - 0.35)), Math.min(1, Math.max(0, k * 1.6 - 0.95))];
}

export function hsl(h: number, s: number, l: number): [number, number, number] {
  const c = new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l);
  return [c.r, c.g, c.b];
}
