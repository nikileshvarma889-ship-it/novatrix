// Renders public/icons/icon.svg to the PNG sizes the PWA manifest needs (uses the pre-installed Playwright Chromium).
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require(execSync("npm root -g").toString().trim() + "/playwright"); }
const { chromium } = pw;
import { readFileSync } from "node:fs";
const svg = readFileSync(new URL("../public/icons/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
const jobs = [["icon-192.png", 192, 0, 16], ["icon-512.png", 512, 0, 16], ["apple-touch-icon.png", 180, 0, 0], ["icon-maskable-512.png", 512, 0.12, 0]];
for (const [name, size, pad, radius] of jobs) {
  const inner = Math.round(size * (1 - pad * 2));
  // maskable: full-bleed gradient background with the mark inside the safe zone
  const body = pad
    ? `<div style="width:${size}px;height:${size}px;background:linear-gradient(135deg,#8B6CFF,#38A0FF);display:grid;place-items:center">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div>`
    : `<div style="width:${size}px;height:${size}px">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `).replace('rx="16"', `rx="${radius}"`)}</div>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${body}</body></html>`);
  await page.locator("div").first().screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname, omitBackground: true });
  console.log("wrote", name);
}
await browser.close();
