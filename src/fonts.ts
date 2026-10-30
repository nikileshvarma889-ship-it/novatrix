import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

const faces: { family: string; file: string; weight: string; style?: string }[] = [
  { family: "Cormorant Garamond", file: "cormorant-garamond-latin-500-normal.woff2", weight: "500" },
  { family: "Cormorant Garamond", file: "cormorant-garamond-latin-600-normal.woff2", weight: "600" },
  { family: "Cormorant Garamond", file: "cormorant-garamond-latin-700-normal.woff2", weight: "700" },
  { family: "Cormorant Garamond", file: "cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
  { family: "Inter", file: "inter-latin-400-normal.woff2", weight: "400" },
  { family: "Inter", file: "inter-latin-600-normal.woff2", weight: "600" },
  { family: "Noto Sans Telugu", file: "noto-sans-telugu-telugu-500-normal.woff2", weight: "500" },
];

let loaded = false;
export function ensureFonts() {
  if (loaded) return;
  loaded = true;
  for (const f of faces) {
    loadFont({ family: f.family, url: staticFile(`fonts/${f.file}`), weight: f.weight, style: f.style ?? "normal", format: "woff2" });
  }
}
