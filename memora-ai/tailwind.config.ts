import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        "surface-2": v("surface-2"),
        border: v("border"),
        fg: v("fg"),
        muted: v("muted"),
        subtle: v("subtle"),
        brand: { DEFAULT: v("brand"), 2: v("brand-2"), fg: v("brand-fg") },
        ok: v("ok"),
        warn: v("warn"),
        danger: v("danger"),
        math: v("math"),
        phys: v("phys"),
        chem: v("chem"),
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"], mono: ["var(--font-mono)", "ui-monospace", "monospace"] },
      borderRadius: { xl: "14px", "2xl": "18px" },
      boxShadow: {
        card: "0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 8px 24px -12px rgb(0 0 0 / 0.45)",
        glow: "0 0 0 1px rgb(var(--brand) / 0.35), 0 8px 30px -8px rgb(var(--brand) / 0.45)",
      },
      backgroundImage: {
        "brand-grad": "linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--brand-2)) 100%)",
      },
      keyframes: { shimmer: { "100%": { transform: "translateX(100%)" } } },
      animation: { shimmer: "shimmer 1.4s infinite" },
    },
  },
  plugins: [],
} satisfies Config;
