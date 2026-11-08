/** Shared, deterministic maths for the visuals: easing, random numbers, camera set-ups, and motion of every moving object.
 * Overlays (labels) and the 3D scenes both read these, so callouts stay pinned to the objects. Units: centimetres (s1–s4), metres (s5). */
import * as THREE from "three";
import { Easing } from "remotion";

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const lerp3 = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k) as V3;
export const ease = Easing.bezier(0.42, 0, 0.3, 1);
export const smooth = (a: number, b: number, x: number) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export type V3 = [number, number, number];

/** Seeded generator (mulberry32). */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (i: number, s = 0) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

export type CamSpec = { pos: V3; look: V3; fov: number };

/** Project a world point to pixel coordinates on the 1080x1920 frame. */
export function project(cam: CamSpec, p: V3, w = 1080, h = 1920): { x: number; y: number; visible: boolean } {
  const c = new THREE.PerspectiveCamera(cam.fov, w / h, 0.05, 20000);
  c.position.set(...cam.pos);
  c.lookAt(...cam.look);
  c.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(c);
  return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 };
}

// ------------------------------------------------------------------ the firecracker (cm). Upright: axis = +Y, fuse at the top.
export const FC = { L: 6, R: 0.62, wall: 0.11, plug: 0.45 };
export const FC_BASE: V3 = [0, FC.L / 2, 0];    // centre of an upright firecracker standing on the ground (y = 0)

// ------------------------------------------------------------------ camera set-ups
export function camS1(t: number, d: number): CamSpec {
  const k = ease(clamp01(t / d));
  return { pos: lerp3([15, 6.6, 22], [11, 4.6, 15.5], k), look: lerp3([-0.3, 0.5, 0], [-0.2, 0.6, 0.2], k), fov: 34 };
}
export function camS2(t: number, d: number): CamSpec {
  const k = ease(clamp01(t / d));
  return { pos: lerp3([4.2, 6.4, 19.5], [3.2, 5.0, 15.5], k), look: lerp3([0.35, 3.9, 0], [0.3, 3.6, 0], k), fov: 36 };
}
export function camS3(t: number, d: number, rup: number): CamSpec {
  const pre = ease(clamp01(t / rup));
  const post = ease(clamp01((t - rup) / Math.max(1, d - rup)));
  const p0: V3 = lerp3([3.4, 5.6, 16.5], [2.8, 4.6, 13.5], pre);
  return { pos: lerp3(p0, [8.5, 8.5, 32], post), look: lerp3([0.1, 3.2, 0], [0, 5.2, 0], post), fov: 38 };
}

// ------------------------------------------------------------------ rocket (cm): body bottom (nozzle) starts at y = 40
export const ROCKET_X = 8, ROCKET_Y0 = 40, ROCKET_A = 260;
export const rocketY = (t: number, lift: number) => ROCKET_Y0 + 0.5 * ROCKET_A * Math.max(0, t - lift) ** 2;
export const rocketV = (t: number, lift: number) => ROCKET_A * Math.max(0, t - lift);
export function camS4a(t: number, lift: number): CamSpec {
  const y = rocketY(t, lift);
  const follow = Math.max(0, y - 58);
  const zoom = clamp01((t - lift - 1.5) / 3);
  return { pos: [-6 + 4 * zoom, 34 + follow * 0.97, 128 + 40 * zoom], look: [2, 32 + follow, 0], fov: 40 + 6 * zoom };
}

// ------------------------------------------------------------------ spinner wheel (cm): hub at (0, 60, 0), wheel in the XY plane facing +Z
export const HUB: V3 = [0, 60, 0];
export const WHEEL_R = 9;
export const spinRev = (t: number, ig: number) => { const a = Math.max(0, t - ig); const w = 1.15; const ramp = 1.2; return a < ramp ? 0.5 * (w / ramp) * a * a : 0.5 * w * ramp + w * (a - ramp); };   // revolutions
export function camS4b(t: number, d: number): CamSpec {
  const k = ease(clamp01(t / d));
  return { pos: lerp3([-5, 58, 118], [6, 60, 96], k), look: [0, 55, 0], fov: 46 };
}

// ------------------------------------------------------------------ fireworks finale (m)
export function camS5(t: number, d: number): CamSpec {
  const k = clamp01(t / d);
  return { pos: [0, 6, 40 - 25 * k], look: [0, 135 + 10 * k, -320], fov: 58 };
}
