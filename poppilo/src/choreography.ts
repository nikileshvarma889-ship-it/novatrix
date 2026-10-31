// The Little Animal Parade — character and camera direction.
// Every value is a function of song time t (seconds). Times line up with
// src/song.json (120 BPM: 1 beat = 0.5 s, 1 bar = 2 s).
import lip from "../public/audio/lipsync.json";
import { BEAT, clamp, lerp, ramp, rand, smooth, window } from "./lib/anim";
import { neutralPose, Pose } from "./characters/Character";

export type Who = "bubu" | "lulu" | "toto";

const PI = Math.PI;
const lipsync = lip as { fps: number; mouth: number[]; singers: string[][] };

/** Final standing marks. */
export const MARK: Record<Who, { x: number; z: number }> = {
  bubu: { x: -2.1, z: 0 },
  toto: { x: 0, z: -0.45 },
  lulu: { x: 2.1, z: 0 },
};

const CLAPS = [22.0, 22.75, 23.5, 24.0, 24.5];

// ---------- building blocks ----------
function blink(t: number, seed: number) {
  const period = 2.6 + rand(seed) * 1.4;
  const ph = (t + seed * 1.3) % period;
  return ph < 0.14 ? Math.sin((ph / 0.14) * PI) : 0;
}

function walkCycle(p: Pose, t: number, w: number, speed = 1) {
  const c = t * 2 * PI * 1.1 * speed;
  p.legL += Math.sin(c) * 0.55 * w;
  p.legR += -Math.sin(c) * 0.55 * w;
  p.armL.forward += -Math.sin(c) * 0.45 * w;
  p.armR.forward += Math.sin(c) * 0.45 * w;
  p.y += Math.abs(Math.sin(c)) * 0.07 * w;
  p.sway += Math.sin(c) * 0.06 * w;
  p.headTilt += Math.sin(c) * 0.04 * w;
}

/** Parabolic hop between t0 and t1 with squash on take-off/landing. */
function hop(p: Pose, t: number, t0: number, t1: number, height: number) {
  if (t < t0 - 0.12 || t > t1 + 0.18) return 0;
  if (t < t0) {
    p.squash *= 1 - 0.18 * ramp(t, t0 - 0.12, t0); // crouch
    return 0;
  }
  if (t > t1) {
    p.squash *= 1 - 0.2 * Math.sin(((t - t1) / 0.18) * PI); // land
    return 0;
  }
  const u = (t - t0) / (t1 - t0);
  p.y += 4 * height * u * (1 - u);
  p.squash *= 1 + 0.12 * Math.sin(u * PI) * (u < 0.5 ? 1 : 0.4);
  p.armL.raise += 1.2 * Math.sin(u * PI);
  p.armR.raise += 1.2 * Math.sin(u * PI);
  p.legL -= 0.3 * Math.sin(u * PI);
  p.legR -= 0.3 * Math.sin(u * PI);
  return u;
}

function wave(p: Pose, t: number, t0: number, t1: number, side: "L" | "R", toward = 0) {
  const w = window(t, t0, t1, 0.3);
  if (!w) return;
  const arm = side === "L" ? p.armL : p.armR;
  arm.raise = lerp(arm.raise, 2.55, w);
  arm.wave = t * 11;
  p.headTilt += (side === "L" ? -0.1 : 0.1) * w;
  p.headTurn += toward * w;
  p.smile = lerp(p.smile, 1, w);
  p.happyEyes = Math.max(p.happyEyes, 0.35 * w);
  p.brows += 0.6 * w;
}

function clap(p: Pose, t: number, w: number) {
  if (!w) return;
  let c = 0;
  for (const ct of CLAPS) c = Math.max(c, 1 - clamp(Math.abs(t - ct) / 0.2));
  const open = 1 - c;
  p.armL.forward = lerp(p.armL.forward, 1.3, w);
  p.armR.forward = lerp(p.armR.forward, 1.3, w);
  p.armL.raise = lerp(p.armL.raise, -0.25 + open * 0.75, w);
  p.armR.raise = lerp(p.armR.raise, -0.25 + open * 0.75, w);
  p.squash *= 1 - 0.05 * c * w;
  p.smile = lerp(p.smile, 1, w);
}

function laugh(p: Pose, t: number, t0: number, t1: number) {
  const w = window(t, t0, t1, 0.15);
  if (!w) return;
  p.headNod -= 0.28 * w;
  p.happyEyes = Math.max(p.happyEyes, 0.9 * w);
  p.mouthOpen = Math.max(p.mouthOpen, (0.55 + 0.35 * Math.abs(Math.sin(t * 22))) * w);
  p.y += Math.abs(Math.sin(t * 22)) * 0.03 * w;
  p.armL.forward += 0.5 * w;
  p.armR.forward += 0.5 * w;
  p.brows += 0.8 * w;
}

/** Three dance styles, all locked to the beat. */
function dance(p: Pose, t: number, w: number, style: 0 | 1 | 2, seed = 0) {
  if (!w) return;
  const b = (t / BEAT) * PI; // half cycle per beat
  const bounce = Math.abs(Math.sin(b));
  p.y += bounce * 0.1 * w;
  p.squash *= 1 - (1 - bounce) * 0.06 * w;
  p.headNod += Math.sin(b * 2) * 0.07 * w;
  if (style === 0) {
    // side-to-side sway, arms pumping
    p.sway += Math.sin(b) * 0.16 * w;
    p.headTilt += Math.sin(b) * 0.12 * w;
    p.armL.raise += (0.5 + 0.5 * Math.sin(b)) * 0.9 * w;
    p.armR.raise += (0.5 - 0.5 * Math.sin(b)) * 0.9 * w;
    p.legL += Math.max(0, Math.sin(b)) * 0.3 * w;
    p.legR += Math.max(0, -Math.sin(b)) * 0.3 * w;
  } else if (style === 1) {
    // hands up and wiggle
    p.armL.raise += 2.2 * w;
    p.armR.raise += 2.2 * w;
    p.armL.wave = t * 9 + seed;
    p.armR.wave = t * 9 + seed + PI;
    p.sway += Math.sin(b * 0.5) * 0.2 * w;
    p.twist += Math.sin(b * 0.5) * 0.3 * w;
  } else {
    // twist with arms forward, little steps
    p.twist += Math.sin(b * 0.5) * 0.6 * w;
    p.rotY += Math.sin(b * 0.5) * 0.25 * w;
    p.armL.forward += 0.9 * w;
    p.armR.forward += 0.9 * w;
    p.armL.raise += 0.35 * w;
    p.armR.raise += 0.35 * w;
    p.legL += Math.sin(b) * 0.25 * w;
    p.legR -= Math.sin(b) * 0.25 * w;
  }
  p.smile = lerp(p.smile, 1, w);
  p.happyEyes = Math.max(p.happyEyes, 0.25 * w);
}

function spin(p: Pose, t: number, t0: number, t1: number) {
  if (t < t0 || t > t1) return;
  p.rotY += smooth((t - t0) / (t1 - t0)) * 2 * PI;
  p.armL.raise += 0.9;
  p.armR.raise += 0.9;
}

function sing(p: Pose, who: Who, t: number) {
  const f = Math.min(lipsync.mouth.length - 1, Math.max(0, Math.round(t * lipsync.fps)));
  if (lipsync.singers[f]?.includes(who)) {
    p.mouthOpen = Math.max(p.mouthOpen, lipsync.mouth[f] * 0.95);
    p.brows += lipsync.mouth[f] * 0.25;
  }
}

/** Shared section: claps, laugh, dances, goodbye. */
function together(p: Pose, who: Who, t: number, seed: number) {
  clap(p, t, window(t, 21.8, 25.4, 0.2));
  laugh(p, t, 25.5, 26.5);
  // verse dance
  dance(p, t, window(t, 26.3, 30.0), who === "lulu" ? 1 : 0, seed);
  // dance break: a new move every two bars, all together
  const styles: (0 | 1 | 2)[] = [0, 1, 2, 1, 0, 2];
  const seg = Math.floor((t - 30) / 2);
  if (t >= 30 && t < 42) dance(p, t, window(t, 30 + seg * 2 - 0.15, 30 + seg * 2 + 2.15, 0.15), styles[seg], seed);
  spin(p, t, 37.0, 38.0);
  hop(p, t, 41.2, 41.75, 0.5);
  // goodbye
  wave(p, t, 42.0, 52, who === "bubu" ? "R" : who === "lulu" ? "L" : "R");
  dance(p, t, window(t, 42.0, 52) * 0.4, 0, seed);
}

// ---------- characters ----------
export function poseAt(who: Who, t: number): Pose {
  const p = neutralPose();
  const seed = who === "bubu" ? 1 : who === "lulu" ? 2 : 3;
  const m = MARK[who];
  p.x = m.x;
  p.z = m.z;
  // idle life: breathing + eye darts
  p.squash *= 1 + Math.sin(t * 2.4 + seed) * 0.012;
  p.lookX = Math.sin(t * 0.7 + seed) * 0.3;
  p.lookY = Math.sin(t * 0.5 + seed * 2) * 0.2;
  p.blink = blink(t, seed);

  if (who === "bubu") {
    // walks in from the left, waves to the camera
    if (t < 4.8) {
      const u = smooth(ramp(t, 0.6, 4.8) * 1.0);
      p.x = lerp(-8.5, m.x, ramp(t, 0.6, 4.8));
      p.z = lerp(1.2, m.z, u);
      p.rotY = PI / 2;
      walkCycle(p, t, window(t, 0.5, 4.9, 0.3));
    }
    p.rotY = lerp(t < 4.8 ? PI / 2 : PI / 2, 0, ramp(t, 4.5, 5.2));
    p.happyEyes = 0.4 * window(t, 5.1, 6.0, 0.2);
    wave(p, t, 5.4, 9.8, "R");
    // watches Lulu arrive, gets excited
    p.headTurn += 0.55 * window(t, 10.1, 12.5, 0.4);
    p.brows += 0.8 * window(t, 11.6, 13.4, 0.2);
    hop(p, t, 12.65, 13.15, 0.45);
    wave(p, t, 13.15, 14.0, "R", 0.4);
    // jump up high, turn around
    hop(p, t, 14.3, 14.8, 0.6);
    hop(p, t, 15.3, 15.8, 0.6);
    spin(p, t, 16.0, 17.0);
    dance(p, t, window(t, 17.0, 19.2), 0, seed);
    // Toto appears behind the tree
    p.headTurn += 0.6 * window(t, 19.2, 21.5, 0.3);
    p.brows += 0.9 * window(t, 19.2, 20.4, 0.2);
    p.mouthOpen = Math.max(p.mouthOpen, 0.35 * window(t, 19.4, 20.2, 0.15));
    together(p, who, t, seed);
  }

  if (who === "lulu") {
    p.earFlop = 0;
    if (t < 12.3) {
      // three bunny hops in from the right
      const hops: [number, number, number, number][] = [
        [10.0, 10.6, 8.6, 6.4],
        [10.8, 11.4, 6.4, 4.3],
        [11.6, 12.2, 4.3, m.x],
      ];
      p.x = 9.5;
      for (const [a, b, x0, x1] of hops) {
        if (t >= a - 0.15) p.x = t >= b ? x1 : lerp(x0, x1, clamp((t - a) / (b - a)));
        const u = hop(p, t, a, b, 0.75);
        if (t >= a && t <= b) p.earFlop = Math.cos(u * PI) * 0.8;
      }
      if (t < 9.85) p.x = 9.5;
      p.rotY = -PI / 2;
    }
    p.rotY = lerp(-PI / 2, 0, ramp(t, 12.2, 12.8));
    wave(p, t, 12.7, 14.0, "L", -0.45);
    p.happyEyes = Math.max(p.happyEyes, 0.5 * window(t, 12.4, 14.0, 0.2));
    const u1 = hop(p, t, 14.3, 14.8, 0.65);
    const u2 = hop(p, t, 15.3, 15.8, 0.65);
    if (t > 14.3 && t < 15.8) p.earFlop = Math.cos((u1 || u2) * PI) * 0.6;
    spin(p, t, 16.0, 17.0);
    dance(p, t, window(t, 17.0, 19.2), 1, seed);
    p.headTurn += -0.5 * window(t, 19.2, 21.5, 0.3);
    p.brows += 0.9 * window(t, 19.2, 20.4, 0.2);
    together(p, who, t, seed);
    // ears bounce with the dancing
    p.earFlop += Math.sin((t / BEAT) * PI * 2) * 0.12 * window(t, 26, 52);
  }

  if (who === "toto") {
    const tree = { x: 4.8, z: -3.7 };
    if (t < 19.0) {
      p.x = tree.x;
      p.z = tree.z;
    } else if (t < 19.7) {
      // peeks out from behind the trunk
      const u = ramp(t, 19.0, 19.5);
      p.x = tree.x - 0.85 * u;
      p.z = tree.z;
      p.headTilt = -0.35 * u;
      p.rotY = 0.2;
      p.brows = 0.8 * u;
    } else if (t < 21.5) {
      const u = ramp(t, 19.7, 21.5);
      p.x = lerp(tree.x - 0.85, m.x, u);
      p.z = lerp(tree.z, m.z, u);
      p.rotY = Math.atan2(m.x - (tree.x - 0.85), m.z - tree.z);
      walkCycle(p, t, window(t, 19.65, 21.55, 0.2), 1.2);
    }
    p.rotY = t < 21.5 ? p.rotY : lerp(Math.atan2(m.x - (tree.x - 0.85), m.z - tree.z), 0, ramp(t, 21.5, 21.9));
    if (t > 21.5 && t < 21.9) p.rotY = lerp(Math.atan2(m.x - (tree.x - 0.85), m.z - tree.z), 0, ramp(t, 21.5, 21.9));
    wave(p, t, 21.4, 22.3, "R");
    p.happyEyes = Math.max(p.happyEyes, 0.5 * window(t, 21.4, 22.4, 0.2));
    together(p, who, t, seed);
  }

  sing(p, who, t);
  return p;
}

// ---------- camera ----------
export type Cam = { pos: [number, number, number]; target: [number, number, number]; fov: number };

const mix3 = (a: number[], b: number[], u: number) => a.map((v, i) => lerp(v, b[i], u)) as [number, number, number];
const shot = (t: number, t0: number, t1: number, a: Cam, b: Cam): Cam => {
  const u = smooth((t - t0) / (t1 - t0));
  return { pos: mix3(a.pos, b.pos, u), target: mix3(a.target, b.target, u), fov: lerp(a.fov, b.fov, u) };
};
const orbit = (t: number, t0: number, t1: number, r: number, h: number, a0: number, a1: number, target: [number, number, number], fov: number): Cam => {
  const a = lerp(a0, a1, smooth((t - t0) / (t1 - t0)));
  return { pos: [target[0] + Math.sin(a) * r, h, target[2] + Math.cos(a) * r], target, fov };
};

export function cameraAt(t: number): Cam {
  const lulu = poseAt("lulu", t);
  const toto = poseAt("toto", t);
  if (t < 5.0) return shot(t, 0, 5.0, { pos: [3, 5.8, 15], target: [-3, 1.2, 0], fov: 38 }, { pos: [-1.2, 2.0, 8.2], target: [-2.1, 1.2, 0], fov: 36 });
  if (t < 10.0) return shot(t, 5.0, 10.0, { pos: [-1.5, 1.6, 5.4], target: [-2.1, 1.3, 0], fov: 36 }, { pos: [-1.7, 1.55, 4.6], target: [-2.1, 1.35, 0], fov: 36 });
  if (t < 12.6) return { pos: [1.2, 1.8, 8.6], target: [lerp(lulu.x, 0, 0.35), 1.2, 0], fov: 38 };
  if (t < 14.0) return shot(t, 12.6, 14.0, { pos: [0, 1.7, 7.0], target: [0, 1.2, 0], fov: 38 }, { pos: [0, 1.6, 6.3], target: [0, 1.25, 0], fov: 38 });
  if (t < 18.0) return shot(t, 14.0, 18.0, { pos: [-0.6, 0.6, 6.4], target: [0, 1.5, 0], fov: 46 }, { pos: [0.6, 0.65, 6.0], target: [0, 1.5, 0], fov: 46 });
  if (t < 19.2) return { pos: [0, 1.8, 8.0], target: [0, 1.2, 0], fov: 38 };
  if (t < 21.5) return shot(t, 19.2, 21.5, { pos: [2.6, 1.6, 5.2], target: [4.0, 1.3, -3.2], fov: 38 }, { pos: [1.4, 1.7, 6.4], target: [toto.x * 0.5, 1.25, -0.6], fov: 38 });
  if (t < 25.5) return shot(t, 21.5, 25.5, { pos: [0, 2.0, 8.8], target: [0, 1.15, 0], fov: 38 }, { pos: [0, 1.85, 8.0], target: [0, 1.2, 0], fov: 38 });
  if (t < 30.0) return orbit(t, 25.5, 30, 6.4, 1.6, -0.25, 0.25, [0, 1.2, 0], 38);
  if (t < 33.0) return orbit(t, 30, 33, 10.5, 3.4, -0.6, 0.25, [0, 1.1, 0], 38);
  if (t < 35.0) return shot(t, 33, 35, { pos: [2.5, 1.65, 3.4], target: [2.1, 1.45, 0], fov: 34 }, { pos: [2.3, 1.62, 3.0], target: [2.1, 1.45, 0], fov: 34 });
  if (t < 37.0) return shot(t, 35, 37, { pos: [0.3, 1.65, 2.9], target: [0, 1.45, -0.45], fov: 34 }, { pos: [-0.1, 1.62, 2.6], target: [0, 1.45, -0.45], fov: 34 });
  if (t < 39.0) return shot(t, 37, 39, { pos: [-2.5, 1.65, 3.2], target: [-2.1, 1.45, 0], fov: 36 }, { pos: [-2.0, 1.6, 3.4], target: [-2.1, 1.35, 0], fov: 40 });
  if (t < 42.0) return orbit(t, 39, 42, 6.6, 1.0, 0.55, -0.55, [0, 1.35, 0], 42);
  return shot(t, 42, 52, { pos: [0, 1.9, 8.0], target: [0, 1.3, 0], fov: 38 }, { pos: [0, 2.7, 10.8], target: [0, 2.1, 0], fov: 38 });
}
