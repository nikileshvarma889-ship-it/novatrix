import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { dark, light, type Palette } from "./colors";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "../lib/prefs";

type Ctx = { c: Palette; isDark: boolean; prefs: Prefs; ready: boolean; setPrefs: (patch: Partial<Prefs>) => void };
const ThemeCtx = createContext<Ctx>({ c: light, isDark: false, prefs: DEFAULT_PREFS, ready: false, setPrefs: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [prefs, setState] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  useEffect(() => { loadPrefs().then((p) => { setState(p); setReady(true); }); }, []);
  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setState((prev) => { const next = { ...prev, ...patch }; savePrefs(next).catch(() => {}); return next; });
  }, []);
  const isDark = prefs.theme === "dark" || (prefs.theme === "system" && system === "dark");
  const value = useMemo(() => ({ c: isDark ? dark : light, isDark, prefs, ready, setPrefs }), [isDark, prefs, ready, setPrefs]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);
