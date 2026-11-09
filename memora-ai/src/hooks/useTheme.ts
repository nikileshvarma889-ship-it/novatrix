"use client";
import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";

export function applyTheme(t: Theme) {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#080a16" : "#f5f6fb");
  try { localStorage.setItem("memora-theme", t); } catch { /* storage unavailable */ }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    try { setTheme((localStorage.getItem("memora-theme") as Theme) || "dark"); } catch { /* storage unavailable */ }
  }, []);
  const set = useCallback((t: Theme) => { setTheme(t); applyTheme(t); }, []);
  return { theme, setTheme: set };
}

/** Inline script (runs before first paint) so the saved theme never flashes. Dark is the default. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('memora-theme')||'dark';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`;
