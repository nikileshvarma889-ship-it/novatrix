import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { EmptyState, Screen } from "../components/ui";
import { VerseCard } from "../components/VerseCard";
import { useTheme } from "../theme/ThemeProvider";
import { HIGHLIGHTS, type HighlightColor } from "../theme/colors";
import { fonts } from "../theme/typography";
import { setHighlight } from "../lib/marks";
import { parseRef } from "../lib/ref";
import { useVerseTexts } from "../bible/preview";

type H = { ref: string; vid: number; color: HighlightColor };

export default function Highlights() {
  const { c, isDark } = useTheme();
  const db = useSQLiteContext();
  const [rows, setRows] = useState<H[] | null>(null);
  const [filter, setFilter] = useState<HighlightColor | null>(null);
  const load = useCallback(() => { db.getAllAsync<H>("SELECT ref, vid, color FROM highlights WHERE deleted = 0 ORDER BY vid").then(setRows).catch(() => setRows([])); }, [db]);
  useFocusEffect(load);
  const shown = (rows ?? []).filter((r) => !filter || r.color === filter);
  const texts = useVerseTexts(shown.map((r) => r.vid));
  const count = (k: HighlightColor) => (rows ?? []).filter((r) => r.color === k).length;
  return (
    <Screen padTop={false}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <Pressable onPress={() => setFilter(null)} accessibilityRole="radio" accessibilityState={{ checked: !filter }} accessibilityLabel="All colours"
          style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: !filter ? c.primary : c.border, backgroundColor: !filter ? c.primary : c.surface }}>
          <Text style={{ fontFamily: fonts.uiMedium, fontSize: 13, color: !filter ? c.primaryText : c.text }}>All · {rows?.length ?? 0}</Text>
        </Pressable>
        {(Object.keys(HIGHLIGHTS) as HighlightColor[]).map((k) => (
          <Pressable key={k} onPress={() => setFilter(k)} accessibilityRole="radio" accessibilityState={{ checked: filter === k }} accessibilityLabel={`${k} highlights`}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: filter === k ? 2 : 1, borderColor: filter === k ? c.primary : c.border, backgroundColor: HIGHLIGHTS[k][isDark ? "dark" : "light"] }}>
            <Text style={{ fontFamily: fonts.uiMedium, fontSize: 13, color: c.text, textTransform: "capitalize" }}>{k} · {count(k)}</Text>
          </Pressable>
        ))}
      </View>
      {rows && !shown.length ? <EmptyState icon="underline" title="No highlights" body="While reading, tap a verse and pick a colour to highlight it." /> : null}
      {shown.map((h) => {
        const r = parseRef(h.ref)!;
        return <VerseCard key={h.ref} refStr={h.ref} te={texts[h.vid]?.te} en={texts[h.vid]?.en} bg={HIGHLIGHTS[h.color][isDark ? "dark" : "light"]}
          actions={[{ icon: "trash", label: `Remove highlight from ${h.ref}`, onPress: () => setHighlight(db, [{ book: r.book, chapter: r.chapter, verse: r.verse! }], null).then(load) }]} />;
      })}
    </Screen>
  );
}
