import React, { useMemo } from "react";
import * as THREE from "three";
import { V3, hash, clamp01, rocketY, rocketV, ROCKET_X, HUB, WHEEL_R, spinRev } from "../sim";
import { PBuf, fire, hsl } from "./Particles";
import { Glow, LightField } from "./Lights";

function stripeTexture(a: string, b: string, n = 6) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = a; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < n; i++) { x.save(); x.translate(0, (i + 0.5) * 512 / n); x.rotate(-0.35); x.fillStyle = b; x.fillRect(-100, -14, 500, 28); x.restore(); }
  const r = (() => { let s = 4; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.05})`; x.fillRect(r() * 256, r() * 512, 1 + r() * 10, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Sky rocket (cm): paper motor tube, nose cone, guide stick. Origin = nozzle (bottom of the tube). */
export const Rocket: React.FC<{ env: THREE.Texture; burning: number; t: number }> = ({ env, burning, t }) => {
  const m = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ map: stripeTexture("#1f4fa8", "#d8dde6"), roughness: 0.55, envMap: env, envMapIntensity: 0.9 }),
    cone: new THREE.MeshStandardMaterial({ color: "#c9cdd4", roughness: 0.4, metalness: 0.3, envMap: env, envMapIntensity: 1 }),
    stick: new THREE.MeshStandardMaterial({ color: "#a07a4c", roughness: 0.8, envMap: env, envMapIntensity: 0.3 }),
    nozzle: new THREE.MeshStandardMaterial({ color: "#6d6862", roughness: 0.95 }),
  }), [env]);
  return (
    <group>
      <mesh material={m.body} position={[0, 7, 0]}><cylinderGeometry args={[1.35, 1.35, 13, 40]} /></mesh>
      <mesh material={m.cone} position={[0, 15.8, 0]}><coneGeometry args={[1.5, 4.6, 40]} /></mesh>
      <mesh material={m.nozzle} position={[0, 0.25, 0]}><cylinderGeometry args={[1.36, 1.2, 0.5, 40]} /></mesh>
      <mesh material={m.stick} position={[1.75, -18, 0]}><boxGeometry args={[0.45, 52, 0.45]} /></mesh>
      <mesh material={m.stick} position={[1.6, 3, 0]}><boxGeometry args={[0.7, 1.2, 0.7]} /></mesh>
      {burning > 0 ? (
        <>
          <Glow pos={[0, -0.6, 0]} color="#fff2c8" size={6 + Math.sin(t * 50) * 0.8} intensity={burning} />
          <Glow pos={[0, -2.5, 0]} color="#ff9a3a" size={14} intensity={0.7 * burning} />
          <pointLight position={[0, -3, 3]} color="#ffae5a" intensity={2600 * burning} distance={160} decay={2} />
        </>
      ) : null}
    </group>
  );
};

/** Exhaust from the rocket nozzle: particles leave downward relative to the rocket and keep their own path (cm). */
export function rocketExhaust(add: PBuf, smoke: PBuf, t: number, ig: number, lift: number) {
  const rate = 420, life = 1.0;
  for (let k = Math.max(0, Math.floor((t - life - ig) * rate)); k <= Math.floor((t - ig) * rate); k++) {
    const te = ig + k / rate, age = t - te;
    if (age < 0 || age > life) continue;
    const ny = rocketY(te, lift), vr = rocketV(te, lift);
    const sp = 320 + 180 * hash(k, 1), ang = hash(k, 2) * Math.PI * 2, spread = 0.18 * hash(k, 3);
    let vx = Math.cos(ang) * spread * sp, vy = vr - sp, vz = Math.sin(ang) * spread * sp;
    const kd = 3.0, d = (1 - Math.exp(-kd * age)) / kd;
    let y = ny + vy * d;
    let x = ROCKET_X + vx * d, z = vz * d;
    if (y < 1) { const over = 1 - y; y = 1 + over * 0.05; x += Math.cos(ang) * over * 0.9; z += Math.sin(ang) * over * 0.9; }   // spray across the ground before lift-off
    const T = 1.15 - age / life * 1.0;
    const c = fire(T);
    add.push(x, y, z, c[0], c[1], c[2], (1 - age / life) * 0.55, 1.2 + age * 3);
    void vx; void vz;
    if (k % 3 === 0 && age > 0.15) {
      const g = 0.32;
      smoke.push(x, y + age * 6, z, g, g * 0.95, g * 0.9, clamp01((age - 0.15) * 3) * (1 - age / life) * 0.35, 4 + age * 14);
    }
  }
}

/** Ground spinner / pinwheel (cm): four tubes mounted tangentially on a wheel. Group is placed at the hub. */
export const Spinner: React.FC<{ env: THREE.Texture; angle: number; burning: number; t: number }> = ({ env, angle, burning, t }) => {
  const m = useMemo(() => ({
    tube: new THREE.MeshStandardMaterial({ map: stripeTexture("#d8a020", "#9c1d6a", 4), roughness: 0.55, envMap: env, envMapIntensity: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: "#8a6a44", roughness: 0.85, envMap: env, envMapIntensity: 0.3 }),
    hub: new THREE.MeshStandardMaterial({ color: "#b8bcc4", roughness: 0.35, metalness: 0.6, envMap: env, envMapIntensity: 1 }),
  }), [env]);
  return (
    <group rotation={[0, 0, angle]}>
      <mesh material={m.hub} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[1.6, 1.6, 2, 32]} /></mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <group key={i} rotation={[0, 0, a]}>
            <mesh material={m.wood} position={[WHEEL_R / 2, 0, -0.6]}><boxGeometry args={[WHEEL_R, 0.8, 0.5]} /></mesh>
            {/* tube lies along the tangent (+Y at angle 0); nozzle at its trailing end (-Y), so exhaust pushes the wheel counter-clockwise */}
            <mesh material={m.tube} position={[WHEEL_R, 0.5, 0]}><cylinderGeometry args={[1.0, 1.0, 7, 28]} /></mesh>
            {burning > 0 ? <Glow pos={[WHEEL_R, -3.4, 0]} color="#fff0c0" size={4 + Math.sin(t * 45 + i) * 0.6} intensity={burning} /> : null}
          </group>
        );
      })}
    </group>
  );
};

/** Sparks from the four nozzles: each leaves along -tangent, plus the nozzle's own motion; gravity bends the spiral. */
export function spinnerSparks(add: PBuf, t: number, ig: number) {
  const rate = 260, life = 0.9;
  for (let n = 0; n < 4; n++) {
    for (let k = Math.max(0, Math.floor((t - life - ig) * rate)); k <= Math.floor((t - ig) * rate); k++) {
      const te = ig + k / rate, age = t - te;
      if (age < 0 || age > life) continue;
      const th = spinRev(te, ig) * Math.PI * 2 + (n * Math.PI) / 2;
      const w = 2 * Math.PI * 1.15 * clamp01((te - ig) / 1.2);
      const nx = HUB[0] + Math.cos(th) * WHEEL_R - Math.sin(th) * -3.4, ny = HUB[1] + Math.sin(th) * WHEEL_R + Math.cos(th) * -3.4;
      // tangent (direction of rotation) = (-sin, cos); exhaust goes the other way
      const sp = 210 + 110 * hash(k * 4 + n, 1), jit = (hash(k * 4 + n, 2) - 0.5) * 0.35;
      const ex = Math.sin(th + jit) * sp, ey = -Math.cos(th + jit) * sp;
      const vx = ex - Math.sin(th) * w * WHEEL_R, vy = ey + Math.cos(th) * w * WHEEL_R;
      const vz = (hash(k * 4 + n, 3) - 0.5) * 40;
      const kd = 1.6, d = (1 - Math.exp(-kd * age)) / kd;
      const T = 1.15 - age / life * 0.85, c = fire(T);
      for (let j = 0; j < 3; j++) {
        const b = Math.max(0, age - j * 0.012), dj = (1 - Math.exp(-kd * b)) / kd;
        add.push(nx + vx * dj, ny + vy * dj - 160 * b * b, vz * dj, c[0], c[1], c[2], (1 - age / life) * (1 - j * 0.3) * 0.9, 0.6);
      }
      void d;
    }
  }
}

// ------------------------------------------------------------------ finale (metres)
export type Burst = [number, number, number, number, number];    // time, x, y, hue, size
const BZ = -320;
export function shells(add: PBuf, t: number, bursts: Burst[]): [number, number, number] {
  const flash: [number, number, number] = [0, 0, 0];
  bursts.forEach(([bt, bx, by, hue, size], b) => {
    const dt = t - bt;
    if (dt < -0.8 || dt > 4) return;
    if (dt < 0) {                                      // rising shell with a glittering tail
      const k = 1 + dt / 0.8;
      for (let j = 0; j < 10; j++) {
        const kk = Math.max(0, k - j * 0.025), y = by * (1 - (1 - kk) ** 2);
        const c = fire(1 - j * 0.07);
        add.push(bx + Math.sin(kk * 6 + b) * 0.8, y, BZ, c[0], c[1], c[2], 0.8 * (1 - j / 10), 0.9);
      }
      return;
    }
    const n = 230, v0 = 115 * size, kd = 1.7;
    const [r, g, bl] = hsl(hue, 0.95, 0.6);
    const fade = 1 - clamp01((dt - 1.6) / 1.8);
    const fl = Math.exp(-dt * 5);
    flash[0] += r * fl * 0.08; flash[1] += g * fl * 0.08; flash[2] += bl * fl * 0.08;
    for (let i = 0; i < n; i++) {
      const u = hash(i + b * 999, 61) * 2 - 1, a = hash(i + b * 999, 62) * Math.PI * 2, rr = Math.sqrt(1 - u * u);
      const v = v0 * (0.92 + 0.08 * hash(i, 63));
      const tw = 0.75 + 0.25 * Math.sin(t * 30 + i);
      for (let j = 0; j < 6; j++) {
        const s = Math.max(0, dt - j * 0.045);
        const d = v * (1 - Math.exp(-kd * s)) / kd;
        const x = bx + rr * Math.cos(a) * d, y = by + u * d - 4.9 * s * s, z = BZ + rr * Math.sin(a) * d;
        const hot = Math.exp(-dt * 3);
        add.push(x, y, z, r + (1 - r) * hot, g + (1 - g) * hot, bl + (1 - bl) * hot, fade * tw * (1 - j * 0.16), j === 0 ? 2.4 : 1.7);
      }
    }
    if (dt < 0.5) add.push(bx, by, BZ, 1, 0.95, 0.85, 1 - dt * 2, 40 * size);
  });
  return flash;
}

/** Distant city skyline silhouette with lit windows (m). */
export const Skyline: React.FC<{ t: number }> = ({ t }) => {
  const { boxes, wins } = useMemo(() => {
    const boxes: { x: number; w: number; h: number; z: number }[] = [];
    const wins: V3[] = [];
    let x = -700;
    let i = 0;
    while (x < 700) {
      const w = 18 + hash(i, 71) * 40, h = 15 + hash(i, 72) ** 2 * 90, z = -560 - hash(i, 73) * 80;
      boxes.push({ x: x + w / 2, w, h, z });
      for (let k = 0; k < (w * h) / 60; k++) if (hash(i * 50 + k, 74) > 0.55) wins.push([x + 3 + hash(i * 50 + k, 75) * (w - 6), 3 + hash(i * 50 + k, 76) * (h - 6), z + 1]);
      x += w + hash(i, 77) * 6; i++;
    }
    return { boxes, wins };
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#030407" }), []);
  return (
    <>
      {boxes.map((b, i) => <mesh key={i} material={mat} position={[b.x, b.h / 2, b.z]}><boxGeometry args={[b.w, b.h, 10]} /></mesh>)}
      <LightField points={wins} color="#ffcf8a" size={0.9} minPx={2} intensity={0.55} twinkle={0.15} t={t} />
      <mesh position={[0, 0, -300]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[4000, 1200]} /><meshBasicMaterial color="#020306" /></mesh>
    </>
  );
};
