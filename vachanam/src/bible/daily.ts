/** Verse of the day: a curated list of well-loved verses (references only; text comes from the installed
 *  translations). Stepping through the list with a stride coprime to its length gives a different verse
 *  every day and no repeat until the whole list has been shown. */
export const DAILY_REFS = [
  "JHN.3.16", "PSA.23.1", "PHP.4.13", "ROM.8.28", "JER.29.11", "PRO.3.5", "ISA.41.10", "MAT.11.28", "PHP.4.6", "JOS.1.9",
  "PSA.46.1", "2CO.5.17", "ROM.12.2", "GAL.5.22", "EPH.2.8", "HEB.11.1", "1JN.4.19", "MAT.6.33", "PSA.119.105", "ISA.40.31",
  "LAM.3.22", "ROM.5.8", "JHN.14.6", "JHN.14.27", "MAT.5.16", "PSA.37.4", "PRO.18.10", "1PE.5.7", "PSA.34.8", "ZEP.3.17",
  "2TI.1.7", "JAS.1.5", "ROM.15.13", "PSA.121.1", "ISA.26.3", "MIC.6.8", "1CO.13.4", "COL.3.23", "PSA.27.1", "NUM.6.24",
  "DEU.31.6", "PSA.91.1", "MAT.28.20", "JHN.15.5", "JHN.16.33", "ROM.10.9", "EPH.3.20", "HEB.13.8", "REV.21.4", "PSA.103.2",
  "PSA.139.14", "ISA.53.5", "JHN.11.25", "1TH.5.16", "PHP.4.19", "GAL.2.20", "MAT.5.9", "PSA.51.10", "PRO.16.3", "ROM.8.38",
  "JHN.1.1", "GEN.1.1", "PSA.118.24", "ISA.9.6", "LUK.1.37",
];
const STRIDE = 17;   // gcd(17, 65) = 1
const EPOCH = Date.UTC(2025, 0, 1);

export function dayNumber(d: Date): number {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86_400_000);
}
export function dailyRef(d: Date = new Date()): string {
  const n = DAILY_REFS.length;
  return DAILY_REFS[(((dayNumber(d) * STRIDE) % n) + n) % n];
}
