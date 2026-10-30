import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { FONTS } from "./config";

const faces: [string, string, string][] = [
  [FONTS.display, "space-grotesk-latin-500-normal.woff2", "500"],
  [FONTS.display, "space-grotesk-latin-700-normal.woff2", "700"],
  [FONTS.body, "inter-latin-400-normal.woff2", "400"],
  [FONTS.body, "inter-latin-600-normal.woff2", "600"],
  [FONTS.body, "inter-latin-800-normal.woff2", "800"],
];

let loaded = false;
export function ensureFonts() {
  if (loaded) return;
  loaded = true;
  for (const [family, file, weight] of faces) {
    loadFont({ family, url: staticFile(`fonts/${file}`), weight, format: "woff2" });
  }
}

export const displayFont = `'${FONTS.display}', 'Inter', sans-serif`;
export const bodyFont = `'${FONTS.body}', sans-serif`;
