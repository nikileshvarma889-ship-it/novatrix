/**
 * Stylised air-traffic radar display (not a reproduction of any real ATC system).
 * Geography is approximate (hand-traced coastlines), in lon/lat, projected equirectangularly.
 */
type LL = [number, number];

const PENINSULA: LL[] = [
  [98.6, 10.4], [98.4, 9.6], [98.3, 8.9], [98.4, 8.1], [98.9, 7.9], [99.4, 7.4], [99.8, 6.8], [100.2, 6.4], [100.35, 5.6], [100.4, 4.9],
  [100.75, 4.1], [101.0, 3.5], [101.35, 2.85], [101.9, 2.4], [102.6, 1.85], [103.4, 1.3], [104.25, 1.4], [103.95, 2.25], [103.45, 2.95],
  [103.4, 3.8], [103.2, 4.6], [102.7, 5.5], [102.25, 6.15], [101.7, 6.8], [101.05, 6.9], [100.45, 7.25], [100.15, 8.0], [99.9, 8.9],
  [99.3, 9.4], [99.2, 10.3], [99.6, 11.1],
];
const VIETNAM: LL[] = [[104.4, 10.45], [104.85, 10.1], [104.85, 9.4], [104.75, 8.65], [105.2, 8.75], [105.9, 9.3], [106.6, 9.85], [106.8, 10.4], [107.6, 10.8], [108.5, 11.2], [109.2, 11.6]];
const CAMBODIA: LL[] = [[102.9, 11.6], [103.3, 11.0], [103.7, 10.6], [104.4, 10.45]];
const SUMATRA: LL[] = [[95.3, 5.6], [96.2, 5.25], [97.2, 5.0], [98.2, 4.1], [99.0, 3.5], [100.0, 2.5], [100.9, 1.9], [102.2, 1.3], [103.0, 0.7], [103.7, 0.0]];

export const PLACES: { n: string; p: LL }[] = [
  { n: "KUALA LUMPUR", p: [101.7, 2.75] },
  { n: "KOTA BHARU", p: [102.29, 6.17] },
  { n: "PENANG", p: [100.27, 5.3] },
  { n: "HO CHI MINH", p: [106.66, 10.82] },
];
export const IGARI: LL = [103.585, 6.936];
export const KLIA: LL = [101.71, 2.74];
// military primary-radar track after the turn-back (approximate, as published in the 2014 factual information)
export const TURNBACK: LL[] = [IGARI, [103.3, 6.75], [102.6, 6.15], [101.7, 5.75], [100.6, 5.45], [100.3, 5.6], [99.4, 6.2], [98.6, 6.5], [97.75, 6.75]];

export type RadarState = {
  t: number;            // seconds, drives the sweep / blink
  clock: string;        // e.g. 17:20:58Z
  progress: number;     // 0..1 along KLIA -> IGARI for the MH370 target
  target: "live" | "coast" | "gone";
  trail: number;        // 0..1 how much of the military track is drawn
  view?: { lon: number; lat: number; span: number };
  traffic?: boolean;
};

export function drawRadar(x: CanvasRenderingContext2D, w: number, h: number, s: RadarState) {
  const v = s.view ?? { lon: 101.8, lat: 5.6, span: 9 };
  const k = w / v.span;
  const P = ([lon, lat]: LL): [number, number] => [w / 2 + (lon - v.lon) * k, h / 2 - (lat - v.lat) * k];
  x.fillStyle = "#03080c"; x.fillRect(0, 0, w, h);
  // range rings around the KL radar head
  const [cx, cy] = P(KLIA);
  x.strokeStyle = "rgba(60,120,140,0.22)"; x.lineWidth = Math.max(1, w / 900);
  for (let r = 1; r <= 8; r++) { x.beginPath(); x.arc(cx, cy, r * k * 0.9, 0, Math.PI * 2); x.stroke(); }
  // lat/lon grid
  x.strokeStyle = "rgba(60,110,130,0.12)";
  for (let lon = 94; lon <= 110; lon++) { const [a] = P([lon, 0]); x.beginPath(); x.moveTo(a, 0); x.lineTo(a, h); x.stroke(); }
  for (let lat = -1; lat <= 13; lat++) { const [, b] = P([0, lat]); x.beginPath(); x.moveTo(0, b); x.lineTo(w, b); x.stroke(); }
  // coastlines
  const line = (pts: LL[], c: string, lw: number, fill?: string) => {
    x.beginPath(); pts.forEach((p, i) => { const [a, b] = P(p); i ? x.lineTo(a, b) : x.moveTo(a, b); });
    if (fill) { x.fillStyle = fill; x.fill(); }
    x.strokeStyle = c; x.lineWidth = lw; x.stroke();
  };
  const lw = Math.max(1.5, w / 600);
  line(PENINSULA, "rgba(120,170,160,0.75)", lw, "rgba(25,45,40,0.55)");
  line(VIETNAM, "rgba(120,170,160,0.75)", lw);
  line(CAMBODIA, "rgba(120,170,160,0.6)", lw);
  line(SUMATRA, "rgba(120,170,160,0.75)", lw);
  const fs = Math.round(w / 42);
  x.font = `bold ${fs}px 'Liberation Mono', monospace`; x.textBaseline = "middle";
  for (const pl of PLACES) {
    const [a, b] = P(pl.p);
    x.fillStyle = "rgba(150,190,185,0.8)"; x.fillRect(a - 3, b - 3, 6, 6);
    x.fillStyle = "rgba(150,190,185,0.7)"; x.textAlign = "left"; x.fillText(pl.n, a + 10, b + fs * 0.1);
  }
  // planned route and waypoint IGARI
  const [ia, ib] = P(IGARI);
  x.setLineDash([lw * 4, lw * 4]); x.strokeStyle = "rgba(90,150,200,0.45)"; x.lineWidth = lw;
  x.beginPath(); x.moveTo(cx, cy); x.lineTo(ia, ib); x.lineTo(...P([105.5, 8.6])); x.stroke(); x.setLineDash([]);
  x.strokeStyle = "rgba(170,210,255,0.9)"; x.lineWidth = lw;
  x.beginPath(); x.moveTo(ia, ib - fs * 0.5); x.lineTo(ia + fs * 0.45, ib + fs * 0.35); x.lineTo(ia - fs * 0.45, ib + fs * 0.35); x.closePath(); x.stroke();
  x.fillStyle = "rgba(170,210,255,0.9)"; x.textAlign = "right"; x.fillText("IGARI", ia - fs * 0.8, ib + fs * 0.9); x.textAlign = "left";
  // other traffic (generic)
  if (s.traffic !== false) {
    const others: [LL, string, string][] = [[[100.9, 4.4], "AXM712", "320"], [[104.4, 3.2], "SIA231", "370"], [[99.6, 8.2], "THA417", "350"], [[106.3, 8.0], "HVN63", "390"]];
    for (const [p, cs, fl] of others) {
      const [a, b] = P([p[0] + s.t * 0.004, p[1] + s.t * 0.002]);
      x.strokeStyle = "rgba(120,200,255,0.75)"; x.lineWidth = lw; x.strokeRect(a - 5, b - 5, 10, 10);
      x.fillStyle = "rgba(120,200,255,0.75)"; x.fillText(cs, a + 12, b - fs * 0.6); x.fillText(fl, a + 12, b + fs * 0.5);
    }
  }
  // MH370 target
  const pos: LL = [KLIA[0] + (IGARI[0] - KLIA[0]) * s.progress, KLIA[1] + (IGARI[1] - KLIA[1]) * s.progress];
  const [ta, tb] = P(pos);
  if (s.target !== "gone") {
    const blink = s.target === "coast" ? (Math.floor(s.t * 3) % 2 === 0 ? 1 : 0.25) : 1;
    const col = s.target === "coast" ? `rgba(255,190,70,${blink})` : "rgba(140,255,170,1)";
    // history dots
    for (let i = 1; i <= 6; i++) {
      const q = s.progress - i * 0.012;
      const [ha, hb] = P([KLIA[0] + (IGARI[0] - KLIA[0]) * q, KLIA[1] + (IGARI[1] - KLIA[1]) * q]);
      x.fillStyle = `rgba(140,255,170,${0.5 - i * 0.07})`; x.beginPath(); x.arc(ha, hb, 3, 0, 7); x.fill();
    }
    x.strokeStyle = col; x.lineWidth = lw * 1.4; x.strokeRect(ta - 8, tb - 8, 16, 16);
    x.beginPath(); x.moveTo(ta + 8, tb - 8); x.lineTo(ta + 34, tb - 34); x.stroke();
    x.fillStyle = col; x.font = `bold ${Math.round(fs * 1.15)}px 'Liberation Mono', monospace`;
    x.fillText("MAS370", ta + 40, tb - 44);
    x.fillText(s.target === "coast" ? "350 CST" : "350 473", ta + 40, tb - 44 + fs * 1.25);
    x.font = `bold ${fs}px 'Liberation Mono', monospace`;
  } else {
    // where it was: faint ghost square
    x.strokeStyle = "rgba(255,80,60,0.25)"; x.setLineDash([3, 4]); x.strokeRect(ta - 8, tb - 8, 16, 16); x.setLineDash([]);
  }
  // military primary radar track (turn-back)
  if (s.trail > 0) {
    const n = TURNBACK.length - 1, upto = s.trail * n;
    x.strokeStyle = "rgba(255,70,55,0.9)"; x.lineWidth = lw * 1.6; x.setLineDash([lw * 2, lw * 3]);
    x.beginPath();
    for (let i = 0; i <= Math.ceil(upto); i++) {
      const j = Math.min(i, upto), i0 = Math.floor(j), f = j - i0;
      const a = TURNBACK[i0], b = TURNBACK[Math.min(n, i0 + 1)];
      const [px, py] = P([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      i ? x.lineTo(px, py) : x.moveTo(px, py);
      if (i === Math.ceil(upto)) { x.stroke(); x.setLineDash([]); x.fillStyle = "rgba(255,90,70,1)"; x.beginPath(); x.arc(px, py, 6 + 3 * Math.sin(s.t * 8), 0, 7); x.fill(); }
    }
    x.setLineDash([]);
  }
  // header / clock
  x.fillStyle = "rgba(10,20,26,0.9)"; x.fillRect(0, 0, w, fs * 2.2);
  x.fillStyle = "rgba(160,200,210,0.95)"; x.textAlign = "left"; x.fillText("KL ACC · SECTOR 3", fs * 0.6, fs * 1.1);
  x.textAlign = "right"; x.fillText(s.clock, w - fs * 0.6, fs * 1.1);
  // scanlines + vignette
  x.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < h; y += 4) x.fillRect(0, y, w, 1);
  const g = x.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.85);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.6)");
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}
