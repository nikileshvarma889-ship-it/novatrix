import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { BOOK_BY_CODE } from "../../../data/books";
import { neighbour } from "../../../lib/nav";
import { useTheme } from "../../../theme/ThemeProvider";
import { fonts, READER_SIZES } from "../../../theme/typography";
import { Icon } from "../../../components/Icon";
import { EmptyState } from "../../../components/ui";

export default function Reader() {
  const { c, prefs, setPrefs } = useTheme();
  const p = useLocalSearchParams<{ book: string; chapter: string }>();
  const book = BOOK_BY_CODE[p.book ?? ""];
  const chapter = Number(p.chapter);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return <View style={{ flex: 1, backgroundColor: c.bg }}><EmptyState icon="info" title="Chapter not found" body="That book or chapter doesn't exist." action={{ label: "Back to books", onPress: () => router.replace("/bible") }} /></View>;
  }
  const prev = neighbour(book.code, chapter, -1), next = neighbour(book.code, chapter, 1);
  const go = (t: { book: string; chapter: number } | null) => t && router.replace(`/read/${t.book}/${t.chapter}`);
  const sizeIdx = READER_SIZES.indexOf(prefs.readerSize as (typeof READER_SIZES)[number]);
  const setSize = (d: number) => setPrefs({ readerSize: READER_SIZES[Math.max(0, Math.min(READER_SIZES.length - 1, (sizeIdx < 0 ? 2 : sizeIdx) + d))] });
  const modeLabel = prefs.readingMode === "parallel" ? "Telugu + English" : prefs.readingMode === "telugu" ? "Telugu" : "English";

  const NavBtn = ({ to, dir }: { to: typeof prev; dir: 1 | -1 }) => (
    <Pressable disabled={!to} onPress={() => go(to)} accessibilityRole="button" accessibilityLabel={dir === 1 ? "Next chapter" : "Previous chapter"}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surface, borderWidth: 0.5, borderColor: c.border, opacity: !to ? 0.35 : pressed ? 0.7 : 1 })}>
      {dir === -1 ? <Icon name="back" color={c.primary} size={16} /> : null}
      <Text style={{ fontFamily: fonts.uiMedium, fontSize: 13.5, color: c.text }}>{to ? `${BOOK_BY_CODE[to.book].name} ${to.chapter}` : "—"}</Text>
      {dir === 1 ? <Icon name="chevron" color={c.primary} size={16} /> : null}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{
        title: `${book.name} ${chapter}`,
        headerRight: () => (
          <View style={{ flexDirection: "row", gap: 4 }}>
            <Pressable onPress={() => setSize(-1)} accessibilityRole="button" accessibilityLabel="Smaller text" style={{ padding: 8 }}><Text style={{ fontFamily: fonts.uiBold, fontSize: 14, color: c.primary }}>A−</Text></Pressable>
            <Pressable onPress={() => setSize(1)} accessibilityRole="button" accessibilityLabel="Larger text" style={{ padding: 8 }}><Text style={{ fontFamily: fonts.uiBold, fontSize: 18, color: c.primary }}>A+</Text></Pressable>
          </View>
        ),
      }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 40, color: c.text, textAlign: "center" }}>{book.name}</Text>
        <Text style={{ fontFamily: fonts.uiMedium, fontSize: 13, letterSpacing: 2, color: c.gold, textAlign: "center", marginBottom: 6 }}>CHAPTER {chapter} · {modeLabel.toUpperCase()}</Text>
        <EmptyState icon="book" title="Bible text not installed yet"
          body={`Book and chapter navigation works now. The licensed Telugu and English texts are imported in Phase 2; then ${book.name} ${chapter} appears here at ${prefs.readerSize}pt.`} />
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 14, borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.bg }}>
        <NavBtn to={prev} dir={-1} />
        <NavBtn to={next} dir={1} />
      </View>
    </View>
  );
}
