/** Font families. Telugu text always uses Noto (Serif for scripture, Sans for UI) so conjuncts render correctly. */
export const fonts = {
  display: "CormorantGaramond_600SemiBold",
  displayItalic: "CormorantGaramond_500Medium_Italic",
  ui: "Inter_400Regular",
  uiMedium: "Inter_500Medium",
  uiBold: "Inter_600SemiBold",
  teluguScripture: "NotoSerifTelugu_400Regular",
  teluguScriptureBold: "NotoSerifTelugu_600SemiBold",
  teluguUi: "NotoSansTelugu_400Regular",
  teluguUiBold: "NotoSansTelugu_600SemiBold",
  englishScripture: "CormorantGaramond_500Medium",
};

/** Reader text sizes users can choose; persisted in preferences. */
export const READER_SIZES = [16, 18, 20, 22, 25, 28] as const;
export const LINE_SPACINGS = [1.4, 1.6, 1.8, 2.0] as const;
