import { dailyRef } from "../bible/daily";

/** The next `count` daily notification times at hh:mm (today included if that time hasn't passed yet),
 *  each with that day's verse reference. Pure, so it is unit-tested. */
export function planDaily(now: Date, hour: number, minute: number, count = 30): { at: Date; ref: string }[] {
  const out: { at: Date; ref: string }[] = [];
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (first.getTime() <= now.getTime() + 30_000) first.setDate(first.getDate() + 1);
  for (let i = 0; i < count; i++) {
    const at = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, hour, minute, 0, 0);
    out.push({ at, ref: dailyRef(at) });
  }
  return out;
}

export function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}
