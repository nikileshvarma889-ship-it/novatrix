// Small animation toolkit: easing, envelopes and deterministic noise.

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const easeOutBack = (t: number) => {
  const c = 1.70158;
  const x = clamp(t) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};
/** 0→1 between a and b with smoothstep. */
export const ramp = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
/** Weight that fades in over `fade` after t0 and out before t1. */
export const window = (t: number, t0: number, t1: number, fade = 0.25) =>
  t < t0 || t > t1 ? 0 : Math.min(ramp(t, t0, t0 + fade), 1 - ramp(t, t1 - fade, t1));
/** Seeded pseudo-random in [0,1). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const BPM = 120;
export const BEAT = 60 / BPM;
/** Position within the current beat, 0..1. */
export const beatPhase = (t: number) => (t / BEAT) % 1;
