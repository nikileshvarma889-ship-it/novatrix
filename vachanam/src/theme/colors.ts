export type Palette = {
  bg: string; surface: string; surfaceAlt: string; border: string; text: string; textMuted: string;
  primary: string; primaryText: string; accent: string; gold: string; goldSoft: string; danger: string; overlay: string;
};

export const light: Palette = {
  bg: "#FBF7EF", surface: "#FFFDF8", surfaceAlt: "#F4EEE1", border: "#E8DECB", text: "#1D2420", textMuted: "#6A6E66",
  primary: "#1F4D3A", primaryText: "#FFFDF8", accent: "#1C2E4A", gold: "#B08A36", goldSoft: "#F3E7C9", danger: "#A23B2F", overlay: "rgba(20,24,20,0.35)",
};

export const dark: Palette = {
  bg: "#0E1512", surface: "#151F1B", surfaceAlt: "#1B2723", border: "#26342E", text: "#ECE6DA", textMuted: "#9BA39C",
  primary: "#86BFA0", primaryText: "#0E1512", accent: "#A9BCDB", gold: "#D6B465", goldSoft: "#2C2717", danger: "#E08A7E", overlay: "rgba(0,0,0,0.55)",
};

/** Highlight colours (Phase 4); each has a light and a dark rendering. */
export const HIGHLIGHTS = {
  yellow: { light: "#FBEFB0", dark: "#5A4E17" },
  green: { light: "#D5EFCF", dark: "#24452B" },
  blue: { light: "#D3E4F7", dark: "#1F3550" },
  pink: { light: "#F8D9E4", dark: "#4E2535" },
  purple: { light: "#E5DCF5", dark: "#372A52" },
} as const;
export type HighlightColor = keyof typeof HIGHLIGHTS;
