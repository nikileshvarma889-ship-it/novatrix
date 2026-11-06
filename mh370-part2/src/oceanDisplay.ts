/**
 * Map / radar display covering the eastern Indian Ocean (stylised; coastlines hand-traced and approximate).
 * Used for the satellite-arc explainer (fact) and the fictional "impossible signal".
 */
type LL = [number, number]; // [lon, lat]

const MALAYA: LL[] = [
  [98.6, 10.4], [98.3, 8.9], [98.4, 8.1], [99.4, 7.4], [100.2, 6.4], [100.4, 4.9], [101.0, 3.5], [101.9, 2.4], [103.4, 1.3], [104.25, 1.4],
  [103.4, 3.8], [102.7, 5.5], [102.25, 6.15], [101.05, 6.9], [100.15, 8.0], [99.3, 9.4], [99.6, 11.1], [98.6, 10.4],
];
const SUMATRA: LL[] = [
  [95.3, 5.6], [97.2, 5.0], [98.2, 4.1], [100.0, 2.5], [101.4, 1.7], [103.7, 0.0], [104.5, -1.0], [105.8, -3.0], [105.9, -5.8], [104.6, -5.9],
  [103.6, -4.9], [102.3, -3.9], [101.1, -2.3], [100.4, -1.0], [99.3, 0.2], [98.7, 1.6], [97.5, 2.4], [96.5, 3.7], [95.6, 4.4], [95.3, 5.6],
];
const JAVA: LL[] = [[105.2, -6.8], [106.5, -7.4], [108.3, -7.8], [110.5, -8.2], [112.5, -8.4], [114.5, -8.7], [114.4, -7.8], [112.7, -6.9], [110.4, -6.9], [108.3, -6.3], [106.1, -5.9], [105.2, -6.8]];
const SUNDA: LL[] = [[115.0, -8.8], [116.5, -8.9], [119.0, -8.7], [121.0, -8.9], [124.0, -9.4], [125.5, -9.0], [127.2, -8.4]];
const BORNEO: LL[] = [[109.0, 1.5], [109.6, -0.6], [110.2, -2.9], [112.0, -3.4], [114.6, -4.0], [116.2, -3.0], [117.5, 0.5], [117.0, 3.0], [116.0, 4.5], [114.0, 4.6], [111.0, 2.5], [109.0, 1.5]];
const AUSTRALIA: LL[] = [
  [140, -10.8], [136.5, -12.0], [132.6, -11.4], [130.0, -13.0], [129.0, -14.9], [126.5, -14.2], [125.0, -15.5], [123.4, -17.0], [122.2, -18.2], [121.0, -19.6],
  [118.8, -20.3], [116.7, -20.6], [114.6, -21.8], [113.6, -23.0], [113.4, -24.9], [114.0, -26.5], [114.6, -28.7], [115.0, -30.0], [115.7, -31.9],
  [115.6, -33.5], [115.0, -34.3], [116.5, -35.0], [118.0, -35.1], [120.0, -33.9], [123.5, -33.9], [126.0, -32.3], [129.0, -31.6], [135, -33], [140, -38], [150, -38], [150, -10.8],
];
const SRI_LANKA: LL[] = [[79.8, 9.8], [80.3, 9.6], [81.3, 8.5], [81.9, 7.0], [81.6, 6.4], [80.6, 5.95], [80.0, 6.6], [79.8, 8.0], [79.8, 9.8]];
const PLACES: { n: string; p: LL }[] = [
  { n: "KUALA LUMPUR", p: [101.7, 3.1] }, { n: "JAKARTA", p: [106.8, -6.2] }, { n: "PERTH", p: [115.86, -31.95] }, { n: "CHRISTMAS IS.", p: [105.7, -10.5] },
];

/** Final satellite-handshake arc ("7th arc"): a circle around the Inmarsat-3F1 sub-satellite point (0°, 64.5°E)
 *  through roughly 35.6°S 92.8°E. Approximate, for illustration. */
export const ARC: LL[] = (() => {
  const d2r = Math.PI / 180;
  const cosR = Math.cos(-35.6 * d2r) * Math.cos((92.8 - 64.5) * d2r);
  const pts: LL[] = [];
  for (let lat = -6; lat >= -42; lat -= 0.5) {
    const c = cosR / Math.cos(lat * d2r);
    if (c > 1) continue;
    pts.push([64.5 + Math.acos(c) / d2r, lat]);
  }
  return pts;
})();

export type OceanState = {
  t: number;
  mode: "map" | "radar";
  header: string;
  clock: string;
  view: { lon: number; lat: number; span: number };
  arc: number;          // 0..1 drawn
  area: number;         // 0..1 search-area overlay
  unknown: number;      // 0..1 "?" marker
  ghost: number;        // 0..1 ghost target visibility
  ghostLabel: number;   // 0..1 label visibility (drops when "the signal disappeared")
  ghostPos: LL;
  track: LL[];          // unlabelled primary returns that keep moving
  glitch: number;       // 0..1 interference
};

export function drawOcean(x: CanvasRenderingContext2D, w: number, h: number, s: OceanState) {
  const v = s.view;
  const k = w / v.span;
  const P = ([lon, lat]: LL): [number, number] => [w / 2 + (lon - v.lon) * k, h / 2 - (lat - v.lat) * k];
  const radar = s.mode === "radar";
  x.fillStyle = radar ? "#03080c" : "#040a10"; x.fillRect(0, 0, w, h);
  const lw = Math.max(1.5, w / 650);
  const fs = Math.round(w / 40);
  // grid
  x.strokeStyle = radar ? "rgba(60,110,130,0.13)" : "rgba(70,110,150,0.16)"; x.lineWidth = 1;
  x.font = `bold ${Math.round(fs * 0.7)}px 'Liberation Mono', monospace`; x.fillStyle = "rgba(90,130,160,0.5)"; x.textBaseline = "middle";
  for (let lon = 60; lon <= 150; lon += 10) { const [a] = P([lon, 0]); x.beginPath(); x.moveTo(a, 0); x.lineTo(a, h); x.stroke(); x.textAlign = "left"; x.fillText(`${lon}°E`, a + 4, h - fs); }
  for (let lat = 20; lat >= -50; lat -= 10) { const [, b] = P([0, lat]); x.beginPath(); x.moveTo(0, b); x.lineTo(w, b); x.stroke(); x.textAlign = "left"; x.fillText(lat === 0 ? "EQ" : lat < 0 ? `${-lat}°S` : `${lat}°N`, 6, b - fs * 0.5); }
  if (radar) {
    const [cx, cy] = P([101.7, 2.75]);
    x.strokeStyle = "rgba(60,120,140,0.18)";
    for (let r = 1; r <= 12; r++) { x.beginPath(); x.arc(cx, cy, r * k * 4, 0, Math.PI * 2); x.stroke(); }
    // rotating sweep from the KL radar head
    const a = (s.t * 1.2) % (Math.PI * 2);
    const g = x.createConicGradient ? x.createConicGradient(a, cx, cy) : null;
    if (g) { g.addColorStop(0, "rgba(90,200,150,0.0)"); g.addColorStop(0.92, "rgba(90,200,150,0.0)"); g.addColorStop(1, "rgba(90,220,160,0.14)"); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  }
  const land = (pts: LL[]) => {
    x.beginPath(); pts.forEach((p, i) => { const [a, b] = P(p); i ? x.lineTo(a, b) : x.moveTo(a, b); });
    x.fillStyle = radar ? "rgba(25,45,40,0.6)" : "rgba(28,44,56,0.85)"; x.fill();
    x.strokeStyle = radar ? "rgba(120,170,160,0.75)" : "rgba(140,180,200,0.8)"; x.lineWidth = lw; x.stroke();
  };
  [MALAYA, SUMATRA, JAVA, BORNEO, AUSTRALIA, SRI_LANKA].forEach(land);
  x.beginPath(); SUNDA.forEach((p, i) => { const [a, b] = P(p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.strokeStyle = "rgba(140,180,200,0.6)"; x.lineWidth = lw * 2; x.stroke();
  x.font = `bold ${fs}px 'Liberation Mono', monospace`;
  for (const pl of PLACES) {
    const [a, b] = P(pl.p);
    x.fillStyle = "rgba(170,200,215,0.85)"; x.fillRect(a - 3, b - 3, 6, 6); x.textAlign = "left"; x.fillText(pl.n, a + 10, b);
  }
  // satellite arc
  if (s.arc > 0) {
    const n = Math.max(2, Math.floor(ARC.length * s.arc));
    x.strokeStyle = "rgba(255,196,80,0.95)"; x.lineWidth = lw * 2; x.setLineDash([lw * 5, lw * 3]);
    x.beginPath(); ARC.slice(0, n).forEach((p, i) => { const [a, b] = P(p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.stroke(); x.setLineDash([]);
    const [la, lb] = P(ARC[Math.min(n, ARC.length) - 1]);
    x.fillStyle = "rgba(255,196,80,0.95)"; x.textAlign = "right"; x.fillText("FINAL SATELLITE ARC", la - 14, lb + fs * 1.4);
  }
  // underwater search area along the southern arc
  if (s.area > 0) {
    x.save(); x.globalAlpha = s.area;
    const seg = ARC.filter(([, lat]) => lat <= -32.5 && lat >= -39.5);
    x.beginPath();
    seg.forEach((p, i) => { const [a, b] = P([p[0] - 1.6, p[1]]); i ? x.lineTo(a, b) : x.moveTo(a, b); });
    [...seg].reverse().forEach((p) => { const [a, b] = P([p[0] + 1.6, p[1]]); x.lineTo(a, b); });
    x.closePath(); x.fillStyle = "rgba(255,120,60,0.22)"; x.fill(); x.strokeStyle = "rgba(255,140,80,0.8)"; x.lineWidth = lw; x.stroke();
    const [ta, tb] = P([seg[seg.length - 1][0] + 2.5, -40.5]);
    x.fillStyle = "rgba(255,160,100,0.95)"; x.textAlign = "left"; x.fillText("SEAFLOOR SEARCHED", ta, tb); x.fillText("NOT FOUND", ta, tb + fs * 1.2);
    x.restore();
  }
  if (s.unknown > 0) {
    const [ua, ub] = P([90.5, -31.5]);
    x.save(); x.globalAlpha = s.unknown * (0.7 + 0.3 * Math.sin(s.t * 4));
    x.font = `bold ${Math.round(fs * 5)}px 'Liberation Mono', monospace`; x.textAlign = "center"; x.fillStyle = "#ffffff";
    x.shadowColor = "rgba(255,255,255,0.6)"; x.shadowBlur = 30; x.fillText("?", ua, ub); x.restore();
  }
  // the impossible target (fiction)
  if (s.ghost > 0) {
    const [ga, gb] = P(s.ghostPos);
    const blink = Math.floor(s.t * 2.5) % 2 === 0 ? 1 : 0.35;
    x.save(); x.globalAlpha = s.ghost;
    x.strokeStyle = `rgba(255,70,60,${blink})`; x.lineWidth = lw * 1.6; x.strokeRect(ga - 10, gb - 10, 20, 20);
    x.beginPath(); x.arc(ga, gb, 30 + 12 * Math.sin(s.t * 5), 0, 7); x.strokeStyle = "rgba(255,70,60,0.35)"; x.stroke();
    if (s.ghostLabel > 0) {
      x.globalAlpha = s.ghost * s.ghostLabel;
      x.beginPath(); x.moveTo(ga + 10, gb - 10); x.lineTo(ga + 40, gb - 40); x.stroke();
      x.font = `bold ${Math.round(fs * 1.25)}px 'Liberation Mono', monospace`; x.fillStyle = `rgba(255,90,70,${blink})`; x.textAlign = "left";
      x.fillText("MAS370", ga + 46, gb - 52); x.fillText("--- ---", ga + 46, gb - 52 + fs * 1.4);
    }
    x.restore();
  }
  // primary returns with no label, still moving
  s.track.forEach(([lon, lat], i) => {
    const [a, b] = P([lon, lat]);
    const last = i === s.track.length - 1;
    x.fillStyle = last ? "rgba(140,255,170,0.95)" : `rgba(140,255,170,${0.15 + 0.5 * (i / s.track.length)})`;
    x.beginPath(); x.arc(a, b, last ? 6 : 3.5, 0, 7); x.fill();
  });
  // header
  x.fillStyle = "rgba(10,20,26,0.92)"; x.fillRect(0, 0, w, fs * 2.2);
  x.font = `bold ${fs}px 'Liberation Mono', monospace`;
  x.fillStyle = radar ? "rgba(160,200,210,0.95)" : "rgba(255,200,110,0.95)"; x.textAlign = "left"; x.fillText(s.header, w * 0.13, fs * 1.1);
  x.textAlign = "right"; x.fillText(s.clock, w * 0.87, fs * 1.1);
  // interference
  if (s.glitch > 0) {
    for (let i = 0; i < 40 * s.glitch; i++) {
      const y = ((Math.sin(i * 97.3 + s.t * 31) + 1) / 2) * h, hh = 2 + ((i * 13) % 9);
      x.fillStyle = `rgba(160,255,200,${0.05 + 0.1 * s.glitch})`; x.fillRect(0, y, w, hh);
    }
  }
  x.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < h; y += 4) x.fillRect(0, y, w, 1);
  const g2 = x.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.85);
  g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(1, "rgba(0,0,0,0.3)");
  x.fillStyle = g2; x.fillRect(0, 0, w, h);
}
