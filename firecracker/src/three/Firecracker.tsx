import React, { useMemo } from "react";
import * as THREE from "three";
import { FC, V3, hash, clamp01 } from "../sim";
import { Glow } from "./Lights";
import { PBuf, fire } from "./Particles";
import { Arrow } from "./Props";

/* A generic firecracker, deliberately simplified (no real construction details): a rolled paper tube, two end plugs,
   a fuse, and an anonymous grey "energetic material" core. Local axis = +Y, centre at the origin, fuse at the top. */

const { L, R, wall, plug } = FC;
const CORE_H = L - 2 * plug;
const RI = R - wall;

export const FUSE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, L / 2 - plug, 0), new THREE.Vector3(0, L / 2, 0), new THREE.Vector3(0.08, L / 2 + 0.6, 0.04),
  new THREE.Vector3(0.45, L / 2 + 1.2, 0.14), new THREE.Vector3(1.1, L / 2 + 1.55, 0.28), new THREE.Vector3(1.8, L / 2 + 1.45, 0.42),
]);
export const fusePoint = (s: number): V3 => { const p = FUSE.getPointAt(clamp01(s)); return [p.x, p.y, p.z]; };

function paperTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
  const x = c.getContext("2d")!;
  // x = around the tube, y = along it
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#9e1418"); g.addColorStop(0.5, "#c01e1f"); g.addColorStop(1, "#9e1418");
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  const r = (() => { let s = 21; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${r() > 0.5 ? "255,220,200" : "40,0,0"},${0.04 + r() * 0.05})`; x.fillRect(r() * 1024, r() * 512, 1 + r() * 18, 1); }   // paper fibres
  for (const y of [70, 442]) { x.fillStyle = "#d9a441"; x.fillRect(0, y - 16, 1024, 32); x.fillStyle = "rgba(90,50,0,0.5)"; x.fillRect(0, y - 16, 1024, 3); x.fillRect(0, y + 13, 1024, 3); }
  x.fillStyle = "#f2d38a"; x.font = "bold 52px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  for (let i = 0; i < 4; i++) { x.save(); x.translate(128 + i * 256, 256); x.rotate(-Math.PI / 2); x.fillText("★  ★  ★", 0, 0); x.restore(); }
  x.strokeStyle = "rgba(60,0,0,0.35)"; x.lineWidth = 2; x.beginPath(); x.moveTo(700, 0); x.lineTo(700, 512); x.stroke();    // paper seam
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function layerTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256;
  const x = c.getContext("2d")!;
  for (let i = 0; i < 64; i++) { const v = 120 + (i % 4) * 18 + (i % 9 === 0 ? -50 : 0); x.fillStyle = `rgb(${v + 30},${v},${v - 40})`; x.fillRect(i, 0, 1, 256); }
  x.fillStyle = "#a3151a"; x.fillRect(58, 0, 6, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Cylinder wedge along Y with UVs mapped to the full circumference (so the label lines up across pieces). */
function tube(radius: number, thetaStart: number, thetaLength: number, h = L) {
  const g = new THREE.CylinderGeometry(radius, radius, h, Math.max(8, Math.round(96 * thetaLength / (Math.PI * 2))), 24, true, thetaStart, thetaLength);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (thetaStart + uv.getX(i) * thetaLength) / (Math.PI * 2));
  g.userData.base = (g.attributes.position.array as Float32Array).slice();
  return g;
}
function applyBulge(g: THREE.BufferGeometry, bulge: number) {
  const base = g.userData.base as Float32Array, p = g.attributes.position.array as Float32Array;
  for (let i = 0; i < p.length; i += 3) {
    const k = 1 + bulge * Math.cos((Math.PI * base[i + 1]) / L) ** 2;
    p[i] = base[i] * k; p[i + 1] = base[i + 1]; p[i + 2] = base[i + 2] * k;
  }
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
}

const coreVS = `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const coreFS = `uniform float uFront; uniform float uHeat; uniform float uT; uniform float uLit; varying vec3 vP; varying vec3 vN;
  float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
  void main(){
    vec3 q = floor(vP*48.0); float n = h(q); float n2 = h(q+3.1);
    vec3 base = mix(vec3(0.10,0.10,0.11), vec3(0.30,0.29,0.28), n) * (0.55 + 0.6*max(dot(vN, normalize(vec3(-0.4,0.7,0.6))),0.0)) * uLit;
    float burned = smoothstep(uFront-0.06, uFront+0.06, vP.y);
    float band = exp(-pow((vP.y-uFront)/0.16, 2.0));
    float fl = 0.65 + 0.35*sin(uT*31.0 + n*40.0);
    vec3 glow = mix(vec3(1.0,0.32,0.05), vec3(1.0,0.78,0.35), n2*fl);
    vec3 c = base*(1.0-0.85*burned) + glow*burned*uHeat*(0.55+0.5*fl)*(0.6+0.6*n) + vec3(1.6,1.3,0.9)*band*uHeat*1.6;
    gl_FragColor = vec4(c, 1.0);
  }`;
const ghostFS = `uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0-abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(vec3(0.75,0.88,1.0), uA*(0.06+0.7*f)); }`;
const ghostVS = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalMatrix*normal; vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`;

export type FcState = {
  cut?: number;        // 0 closed .. 1 cutaway shown
  cutYaw?: number;     // direction (radians about Y) the open wedge faces
  fuse?: number;       // 0 = whole fuse .. 1 = burned down into the tube
  lit?: boolean;       // fuse burning
  burn?: number;       // 0..1 reaction front through the core (top -> bottom)
  heat?: number;       // 0..1 glow of the burned material
  bulge?: number;      // casing swelling (fraction of radius)
  pressure?: number;   // 0..1 outward pressure arrows
  glowCasing?: number; // 0..1 heat seen through the paper
  t: number;
  env: THREE.Texture;
  lit3?: number;
};

export const Firecracker: React.FC<FcState> = ({ cut = 0, cutYaw = 0.25, fuse = 0, lit = false, burn = 0, heat = 0, bulge = 0, pressure = 0, glowCasing = 0, t, env }) => {
  const W = 2.1;                                           // wedge width (radians)
  const geo = useMemo(() => ({
    full: tube(R, 0, Math.PI * 2),
    main: tube(R, cutYaw + W / 2, Math.PI * 2 - W),
    wedge: tube(R, cutYaw - W / 2, W),
    inner: tube(RI, cutYaw + W / 2, Math.PI * 2 - W, L - 0.02),
  }), [cutYaw]);
  const mats = useMemo(() => {
    const paper = paperTexture();
    return {
      paper: new THREE.MeshStandardMaterial({ map: paper, roughness: 0.62, metalness: 0.0, envMap: env, envMapIntensity: 0.9, emissive: new THREE.Color("#ff5a1a"), emissiveIntensity: 0 }),
      closed: new THREE.MeshStandardMaterial({ map: paper, roughness: 0.62, envMap: env, envMapIntensity: 0.9, transparent: true }),
      inner: new THREE.MeshStandardMaterial({ color: "#7a5a3c", roughness: 0.9, side: THREE.BackSide, envMap: env, envMapIntensity: 0.3, emissive: new THREE.Color("#ff6a20"), emissiveIntensity: 0 }),
      layers: new THREE.MeshStandardMaterial({ map: layerTexture(), roughness: 0.9, side: THREE.DoubleSide }),
      plug: new THREE.MeshStandardMaterial({ color: "#8f8b84", roughness: 0.95, envMap: env, envMapIntensity: 0.3 }),
      fuse: new THREE.MeshStandardMaterial({ color: "#3d6b3a", roughness: 0.7, envMap: env, envMapIntensity: 0.5 }),
      core: new THREE.ShaderMaterial({ uniforms: { uFront: { value: 0 }, uHeat: { value: 0 }, uT: { value: 0 }, uLit: { value: 1 } }, vertexShader: coreVS, fragmentShader: coreFS }),
      ghost: new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, vertexShader: ghostVS, fragmentShader: ghostFS, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    };
  }, [env]);
  for (const g of [geo.full, geo.main, geo.wedge]) applyBulge(g, bulge);
  mats.paper.emissiveIntensity = glowCasing * 0.5;
  mats.inner.emissiveIntensity = glowCasing * 0.8;
  mats.closed.opacity = 1 - cut;
  mats.closed.depthWrite = cut < 0.5;
  mats.ghost.uniforms.uA.value = cut;
  const front = CORE_H / 2 - CORE_H * burn;
  mats.core.uniforms.uFront.value = burn <= 0 ? 99 : front;
  mats.core.uniforms.uHeat.value = heat;
  mats.core.uniforms.uT.value = t;

  // remaining fuse: from the tube (s = 0) out to s = 1 - fuse
  const sEnd = 1 - fuse;
  const fuseGeo = useMemo(() => {
    if (sEnd < 0.03) return null;
    const pts = Array.from({ length: 24 }, (_, i) => FUSE.getPointAt((i / 23) * sEnd));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.075, 8, false);
  }, [Math.round(sEnd * 400)]);
  const tip = fusePoint(sEnd);
  const edge = (th: number) => { const rc = R - wall / 2; return { pos: [Math.sin(th) * rc, 0, Math.cos(th) * rc] as V3, rot: [0, th - Math.PI / 2, 0] as V3 }; };
  const e1 = edge(cutYaw + W / 2), e2 = edge(cutYaw - W / 2);
  const arrows: React.ReactNode[] = [];
  if (pressure > 0.02) {
    [-1.6, 0, 1.6].forEach((y, i) => [-1.5, 1.5].forEach((da, j) => {
      const th = cutYaw + da;
      const d: V3 = [Math.sin(th), 0, Math.cos(th)];
      const r0 = R * (1 + bulge) + 0.08;
      const wob = 1 + 0.12 * Math.sin(t * 9 + i * 2 + j);
      arrows.push(<Arrow key={`${i}-${j}`} position={[d[0] * r0, y, d[2] * r0]} dir={d} len={(0.3 + 0.9 * pressure) * wob} r={0.035} color="#ff6a2c" opacity={clamp01(pressure * 3)} />);
    }));
  }
  return (
    <group>
      {cut < 0.999 ? <mesh geometry={geo.full} material={mats.closed} renderOrder={2} /> : null}
      {cut > 0.001 ? (
        <>
          <mesh geometry={geo.main} material={mats.paper} />
          <mesh geometry={geo.inner} material={mats.inner} />
          <mesh geometry={geo.wedge} material={mats.ghost} renderOrder={3} />
          {[e1, e2].map((e, i) => <mesh key={i} position={e.pos} rotation={e.rot} material={mats.layers}><planeGeometry args={[wall, L]} /></mesh>)}
        </>
      ) : null}
      <mesh material={mats.core}><cylinderGeometry args={[RI - 0.01, RI - 0.01, CORE_H, 48, 1]} /></mesh>
      <mesh material={mats.plug} position={[0, L / 2 - plug / 2, 0]}><cylinderGeometry args={[RI, RI, plug, 40]} /></mesh>
      <mesh material={mats.plug} position={[0, -L / 2 + plug / 2, 0]}><cylinderGeometry args={[RI, RI, plug, 40]} /></mesh>
      {fuseGeo ? <mesh geometry={fuseGeo} material={mats.fuse} /> : null}
      {lit && sEnd > 0.02 ? (
        <>
          <Glow pos={tip} color="#ffb04a" size={1.6 + 0.4 * Math.sin(t * 40)} intensity={0.95} />
          <Glow pos={tip} color="#fff3d0" size={0.5} intensity={1} />
          <pointLight position={tip} color="#ff9a3c" intensity={6} distance={12} decay={2} />
        </>
      ) : null}
      {arrows}
    </group>
  );
};

/** Sparks spitting from the burning fuse tip (world coordinates via `origin`). */
export function fuseSparks(buf: PBuf, t: number, tip: V3, origin: V3, rate = 90) {
  const life = 0.5;
  for (let k = Math.floor((t - life) * rate); k <= Math.floor(t * rate); k++) {
    const age = t - k / rate;
    if (age < 0 || age > life) continue;
    const a = hash(k, 1) * Math.PI * 2, el = hash(k, 2) * 1.2 - 0.2, sp = 2 + hash(k, 3) * 5;
    const vx = Math.cos(a) * Math.cos(el) * sp, vy = Math.sin(el) * sp + 1.5, vz = Math.sin(a) * Math.cos(el) * sp;
    const x = tip[0] + origin[0] + vx * age, y = tip[1] + origin[1] + vy * age - 9 * age * age, z = tip[2] + origin[2] + vz * age;
    const T = 1.1 - age / life;
    const c = fire(T);
    for (let j = 0; j < 3; j++) {                        // short streak
      const b = age - j * 0.012;
      if (b < 0) break;
      buf.push(tip[0] + origin[0] + vx * b, tip[1] + origin[1] + vy * b - 9 * b * b, tip[2] + origin[2] + vz * b, c[0], c[1], c[2], (1 - age / life) * (1 - j * 0.3), 0.07);
    }
    void x; void y; void z;
  }
}

/** Hot gas inside the tube: particles born at the reaction front, bouncing faster as pressure rises. */
export function gasInside(buf: PBuf, t: number, burn: number, pressure: number, origin: V3, count = 650) {
  const top = CORE_H / 2, rMax = RI - 0.08;
  const front = top - CORE_H * burn;
  const reflect = (v: number, lo: number, hi: number) => { const w = hi - lo; let m = (v - lo) % (2 * w); if (m < 0) m += 2 * w; return lo + (m < w ? m : 2 * w - m); };
  const active = Math.floor(count * Math.min(1, burn * 1.6 + pressure * 0.4));
  for (let i = 0; i < active; i++) {
    const sp = (0.8 + 2.4 * pressure) * (0.6 + hash(i, 4) * 0.8);
    const tt = t * sp + hash(i, 5) * 20;
    const y = reflect(top - hash(i, 6) * (top - front) + Math.cos(hash(i, 7) * 6.28) * tt, Math.max(front, -top), top);
    let x = reflect(Math.sin(hash(i, 8) * 6.28) * tt * 0.6 + (hash(i, 9) - 0.5), -rMax, rMax);
    let z = reflect(Math.cos(hash(i, 8) * 6.28) * tt * 0.6 + (hash(i, 10) - 0.5), -rMax, rMax);
    const rr = Math.hypot(x, z); if (rr > rMax) { x *= rMax / rr; z *= rMax / rr; }
    const c = fire(0.7 + 0.4 * hash(i, 11));
    buf.push(origin[0] + x, origin[1] + y, origin[2] + z, c[0], c[1], c[2], 0.55, 0.11 + 0.05 * pressure);
  }
}

// ------------------------------------------------------------------ the rupture (scientific visualisation, slowed down)
const FRAG = 170;
export const Explosion: React.FC<{ tr: number; center: V3; env: THREE.Texture }> = ({ tr, center, env }) => {
  const frags = useMemo(() => {
    const r = Array.from({ length: FRAG }, (_, i) => {
      const th = hash(i, 21) * Math.PI * 2, y = (hash(i, 22) - 0.5) * L * 0.92;
      const sp = 4 + hash(i, 23) * 9;
      return { th, y, sp, up: (hash(i, 24) - 0.3) * 4 + y * 0.8, spin: [hash(i, 25) * 8 - 4, hash(i, 26) * 8 - 4, hash(i, 27) * 8 - 4], w: 0.12 + hash(i, 28) * 0.3, h: 0.1 + hash(i, 29) * 0.3 };
    });
    const geo = new THREE.BoxGeometry(1, 1, 0.04);
    const paper = new THREE.MeshStandardMaterial({ color: "#8e1517", roughness: 0.7, envMap: env, envMapIntensity: 0.7, emissive: new THREE.Color("#ff6020"), emissiveIntensity: 0 });
    const mesh = new THREE.InstancedMesh(geo, paper, FRAG);
    return { r, mesh, paper };
  }, [env]);
  if (tr < 0) return null;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const k = 0.9, g = 2.6;
  frags.r.forEach((f, i) => {
    const disp = (1 - Math.exp(-k * tr)) / k;
    const dx = Math.sin(f.th), dz = Math.cos(f.th);
    let y = center[1] + f.y + f.up * disp - 0.5 * g * tr * tr;
    const x = center[0] + dx * (FC.R + f.sp * disp), z = center[2] + dz * (FC.R + f.sp * disp);
    if (y < 0.03) y = 0.03;
    p.set(x, y, z);
    e.set(f.spin[0] * tr, f.th + f.spin[1] * tr, f.spin[2] * tr); q.setFromEuler(e);
    s.set(f.w, f.h, 1);
    m.compose(p, q, s); frags.mesh.setMatrixAt(i, m);
  });
  frags.mesh.instanceMatrix.needsUpdate = true;
  frags.paper.emissiveIntensity = Math.max(0, 1.2 * Math.exp(-tr * 2.5));
  const flash = Math.exp(-tr * 3.2);
  return (
    <>
      <primitive object={frags.mesh} />
      <Glow pos={center} color="#fff4dc" size={34 * (0.4 + 0.6 * flash)} intensity={flash} />
      <Glow pos={center} color="#ffb060" size={16} intensity={Math.exp(-tr * 1.2) * 0.8} />
      <pointLight position={[center[0], center[1] + 0.5, center[2] + 1]} color="#ffb070" intensity={1400 * flash + 40 * Math.exp(-tr * 0.8)} distance={80} decay={2} />
      <Shock tr={tr} center={center} />
    </>
  );
};

/** Pressure wave: a bright refracting shell racing outward plus a dust ring along the ground. */
const Shock: React.FC<{ tr: number; center: V3 }> = ({ tr, center }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uA: { value: 0 } },
    vertexShader: ghostVS,
    fragmentShader: `uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0-abs(dot(normalize(vN), normalize(vV))), 7.0); gl_FragColor = vec4(vec3(0.75,0.85,1.0)*f*uA, 1.0); }`,
  }), []);
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: "#c9b79a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  const rs = 0.9 + 9 * tr;
  const a = Math.exp(-tr * 0.75) * clamp01(tr * 8);
  mat.uniforms.uA.value = a * 0.9;
  ring.opacity = a * 0.35;
  if (a < 0.01) return null;
  return (
    <>
      <mesh material={mat} position={center} scale={[rs, rs, rs]} renderOrder={7}><sphereGeometry args={[1, 48, 32]} /></mesh>
      <mesh material={ring} position={[center[0], 0.04, center[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={7}><ringGeometry args={[Math.max(0, rs * 0.97 - 0.5), rs * 0.97, 96]} /></mesh>
    </>
  );
};

/** Fireball, sparks and smoke after the rupture, written into particle buffers. */
export function burst(add: PBuf, smoke: PBuf, tr: number, c: V3) {
  if (tr < 0) return;
  const N = 1300;
  for (let i = 0; i < N; i++) {
    const u = hash(i, 31) * 2 - 1, a = hash(i, 32) * Math.PI * 2, rr = Math.sqrt(1 - u * u);
    const dir: V3 = [rr * Math.cos(a), u * 0.8 + 0.12, rr * Math.sin(a)];
    const s = 0.35 + 0.65 * Math.cbrt(hash(i, 33));
    const R = 6.2 * s * (1 - Math.exp(-tr * 1.25));
    const lift = tr * tr * 0.18;
    let y = c[1] + dir[1] * R + lift; if (y < 0.1) y = 0.1 + (0.1 - y) * 0.2;
    const T = Math.exp(-tr * (0.3 + 0.35 * s)) * (1.25 - 0.4 * s);
    const col = fire(T);
    const al = clamp01(T * 2.2) * 0.3;
    add.push(c[0] + dir[0] * R, y, c[2] + dir[2] * R, col[0], col[1], col[2], al, 0.45 + 0.9 * (1 - Math.exp(-tr)) * s);
  }
  // sparks: fast glowing grains with short streaks
  for (let i = 0; i < 260; i++) {
    const u = hash(i, 41) * 2 - 1, a = hash(i, 42) * Math.PI * 2, rr = Math.sqrt(1 - u * u);
    const v = 9 + hash(i, 43) * 10;
    const dir: V3 = [rr * Math.cos(a), Math.abs(u) * 0.9 + 0.1, rr * Math.sin(a)];
    const life = 3.5 + hash(i, 44) * 3;
    if (tr > life) continue;
    for (let j = 0; j < 4; j++) {
      const b = Math.max(0, tr - j * 0.03);
      const d = v * (1 - Math.exp(-0.5 * b)) / 0.5;
      const y = c[1] + dir[1] * d - 1.2 * b * b;
      if (y < 0) continue;
      const col = fire(1.05 - tr / life * 0.6);
      add.push(c[0] + dir[0] * d, y, c[2] + dir[2] * d, col[0], col[1], col[2], (1 - tr / life) * (1 - j * 0.22), 0.09);
    }
  }
  // smoke: grey puffs that grow and drift up, tinted by the fire early on
  for (let i = 0; i < 90; i++) {
    const u = hash(i, 51) * 2 - 1, a = hash(i, 52) * Math.PI * 2, rr = Math.sqrt(1 - u * u);
    const s = 0.3 + 0.7 * hash(i, 53);
    const R = 6.2 * s * (1 - Math.exp(-tr * 0.9));
    const t0 = 0.15 + hash(i, 54) * 0.5;
    if (tr < t0) continue;
    const age = tr - t0;
    const glow = Math.exp(-age * 1.4);
    const g = 0.22 + 0.1 * hash(i, 55);
    smoke.push(c[0] + rr * Math.cos(a) * R, Math.max(0.6, c[1] + u * R * 0.7 + age * 0.55), c[2] + rr * Math.sin(a) * R,
      g + glow * 0.6, g + glow * 0.25, g + glow * 0.05, clamp01(age * 1.5) * 0.22 * (1 - clamp01((age - 6) / 4)), 1.0 + 1.4 * s + age * 0.35);
  }
}
