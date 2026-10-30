import { Easing, interpolate } from "remotion";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/** Slow, weighty reveal: fade + slight rise + defocus. No bounce. */
export const reveal = (frame: number, at: number, length = 24) => {
  const p = interpolate(frame, [at, at + length], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return { opacity: p, transform: `translateY(${(1 - p) * 18}px)`, filter: `blur(${(1 - p) * 6}px)` };
};

export const progress = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
