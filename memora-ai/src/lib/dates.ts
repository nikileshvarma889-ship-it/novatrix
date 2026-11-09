/** Timezone-aware date helpers. Default timezone: Asia/Kolkata. */
export const DEFAULT_TZ = "Asia/Kolkata";

export function fmt(d: Date | string | number, tz = DEFAULT_TZ, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, ...opts }).format(new Date(d));
}
export const fmtTime = (d: Date | string | number, tz = DEFAULT_TZ) => fmt(d, tz, { hour: "numeric", minute: "2-digit", hour12: true });
export const fmtDateTime = (d: Date | string | number, tz = DEFAULT_TZ) => fmt(d, tz, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

/** Calendar parts of an instant in a timezone. */
export function partsInTz(d: Date, tz = DEFAULT_TZ) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { y: +g("year"), m: +g("month"), d: +g("day"), h: +g("hour") % 24, min: +g("minute"), weekday: g("weekday") };
}
/** "YYYY-MM-DD" of an instant in a timezone. */
export function dayKey(d: Date | string | number, tz = DEFAULT_TZ) {
  const { y, m, d: dd } = partsInTz(new Date(d), tz);
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
/** Offset (minutes) of the timezone from UTC at a given instant. */
export function tzOffsetMinutes(at: Date, tz = DEFAULT_TZ) {
  const { y, m, d, h, min } = partsInTz(at, tz);
  return Math.round((Date.UTC(y, m - 1, d, h, min) - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}
/** The instant of a wall-clock time ("YYYY-MM-DD", "HH:MM") in a timezone. */
export function zonedToUtc(day: string, time: string, tz = DEFAULT_TZ) {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const off = tzOffsetMinutes(guess, tz);
  return new Date(guess.getTime() - off * 60000);
}
/** Start (UTC instant) of the day containing `d` in tz, plus `addDays`. */
export function startOfDay(d: Date, tz = DEFAULT_TZ, addDays = 0) {
  const key = dayKey(d, tz);
  const [y, m, dd] = key.split("-").map(Number);
  const k2 = new Date(Date.UTC(y, m - 1, dd + addDays)).toISOString().slice(0, 10);
  return zonedToUtc(k2, "00:00", tz);
}
export function addDaysKey(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** Value for <input type="datetime-local"> showing an instant in tz. */
export function toLocalInput(d: Date | string | null | undefined, tz = DEFAULT_TZ) {
  if (!d) return "";
  const x = partsInTz(new Date(d), tz);
  return `${x.y}-${String(x.m).padStart(2, "0")}-${String(x.d).padStart(2, "0")}T${String(x.h).padStart(2, "0")}:${String(x.min).padStart(2, "0")}`;
}
export function fromLocalInput(v: string, tz = DEFAULT_TZ) {
  if (!v) return null;
  const [day, time] = v.split("T");
  return zonedToUtc(day, time || "00:00", tz).toISOString();
}
export function daysUntil(dateKey: string, tz = DEFAULT_TZ) {
  const today = dayKey(new Date(), tz);
  return Math.round((Date.parse(dateKey) - Date.parse(today)) / 86400000);
}
export function relative(d: Date | string | number) {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return fmt(d);
}
export function greeting(tz = DEFAULT_TZ) {
  const h = partsInTz(new Date(), tz).h;
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
export const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney", "UTC"];
