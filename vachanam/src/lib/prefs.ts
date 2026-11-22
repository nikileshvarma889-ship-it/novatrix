import AsyncStorage from "@react-native-async-storage/async-storage";

/** Lightweight preferences (AsyncStorage). User content lives in SQLite, not here. */
export type ThemeChoice = "system" | "light" | "dark";
export type ReadingMode = "parallel" | "telugu" | "english";
export type ParallelLayout = "stacked" | "side";
export type Prefs = {
  theme: ThemeChoice;
  readerSize: number;
  lineSpacing: number;
  readingMode: ReadingMode;
  parallelLayout: ParallelLayout;
  uiLanguage: "en" | "te";
  guideLang: "en" | "te" | "both";
};
export const DEFAULT_PREFS: Prefs = { theme: "system", readerSize: 20, lineSpacing: 1.8, readingMode: "parallel", parallelLayout: "stacked", uiLanguage: "en", guideLang: "en" };
const KEY = "vachanam.prefs.v1";

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}
export async function savePrefs(p: Prefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}
