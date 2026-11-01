import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#1b2140", soft: "#525a7a", faint: "#8b92ad" },
        brand: { 50: "#f2f4ff", 100: "#e4e8ff", 200: "#c9d0ff", 400: "#7d8bff", 500: "#5b6cff", 600: "#4a55e6", 700: "#3c43b8" },
        lilac: { 100: "#efe9ff", 300: "#c9b8ff", 500: "#9b7bff" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], display: ["'Plus Jakarta Sans'", "Inter", "sans-serif"] },
      boxShadow: {
        soft: "0 1px 2px rgba(27,33,64,.04), 0 8px 24px -8px rgba(27,33,64,.10)",
        lift: "0 2px 4px rgba(27,33,64,.05), 0 18px 40px -12px rgba(91,108,255,.25)",
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
} satisfies Config;
