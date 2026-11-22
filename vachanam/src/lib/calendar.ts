/** Christian calendar, 2025–2030 (Western / Gregorian church dates). Pure functions, no I/O. */
export const MIN_YEAR = 2025;
export const MAX_YEAR = 2030;

export const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MONTHS_TE = ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జూలై", "ఆగస్టు", "సెప్టెంబరు", "అక్టోబరు", "నవంబరు", "డిసెంబరు"];
export const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_TE = ["ఆది", "సోమ", "మంగళ", "బుధ", "గురు", "శుక్ర", "శని"];

/** "YYYY-MM-DD" in local time (month is 0-based in the arguments, like Date). */
export const dayKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export const keyOf = (dt: Date) => dayKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
export const parseKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (dt: Date, n: number) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);

/** Easter Sunday (Gregorian), Meeus/Jones/Butcher algorithm. */
export function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export type Feast = { key: string; en: string; te?: string; major: boolean };

/** Main observances of the church year; `te` is given only where the Telugu name is standard in Telugu churches. */
export function feasts(year: number): Feast[] {
  const E = easter(year);
  const xmas = new Date(year, 11, 25);
  const advent1 = addDays(xmas, -((xmas.getDay() || 7) + 21));   // 4th Sunday before Christmas
  const list: [Date, string, string | undefined, boolean][] = [
    [new Date(year, 0, 1), "New Year's Day", "నూతన సంవత్సరం", true],
    [new Date(year, 0, 6), "Epiphany", undefined, false],
    [addDays(E, -46), "Ash Wednesday", "బూడిద బుధవారం", false],
    [addDays(E, -7), "Palm Sunday", "మట్టల ఆదివారం", true],
    [addDays(E, -3), "Maundy Thursday", undefined, false],
    [addDays(E, -2), "Good Friday", "గుడ్ ఫ్రైడే", true],
    [E, "Easter Sunday", "ఈస్టర్", true],
    [addDays(E, 39), "Ascension Day", "ఆరోహణ దినం", false],
    [addDays(E, 49), "Pentecost", "పెంతెకొస్తు", true],
    [addDays(E, 56), "Trinity Sunday", undefined, false],
    [new Date(year, 9, 31), "Reformation Day", undefined, false],
    [new Date(year, 10, 1), "All Saints' Day", undefined, false],
    [advent1, "First Sunday of Advent", undefined, false],
    [new Date(year, 11, 24), "Christmas Eve", undefined, false],
    [xmas, "Christmas", "క్రిస్మస్", true],
    [new Date(year, 11, 31), "Watch Night", undefined, false],
  ];
  return list.map(([dt, en, te, major]) => ({ key: keyOf(dt), en, te, major })).sort((a, b) => a.key.localeCompare(b.key));
}

/** All feasts in the supported range, keyed by day. */
export function feastIndex(): Record<string, Feast[]> {
  const idx: Record<string, Feast[]> = {};
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) for (const f of feasts(y)) (idx[f.key] ??= []).push(f);
  return idx;
}

/** Month grid: 6 weeks × 7 days (Sunday first); null = padding outside the month. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** Next major feast on or after `from`, within the supported range. */
export function nextFeast(from: Date): (Feast & { days: number }) | null {
  const k = keyOf(from);
  for (let y = Math.max(MIN_YEAR, from.getFullYear()); y <= MAX_YEAR; y++) {
    const f = feasts(y).find((x) => x.major && x.key >= k);
    if (f) return { ...f, days: Math.round((parseKey(f.key).getTime() - parseKey(k).getTime()) / 86_400_000) };
  }
  return null;
}

export const clampMonth = (y: number, m: number): [number, number] => {
  if (y < MIN_YEAR) return [MIN_YEAR, 0];
  if (y > MAX_YEAR) return [MAX_YEAR, 11];
  return [y, m];
};
