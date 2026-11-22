import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOOKS, type BookMeta, type Testament } from "../../data/books";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/typography";
import { Icon } from "../../components/Icon";
import type { ReadingMode } from "../../lib/prefs";
import { useBibleDb } from "../../bible/BibleProvider";
import { loadBookNames, TE, type BookNames } from "../../bible/repo";

const MODES: { key: ReadingMode; label: string }[] = [{ key: "parallel", label: "Parallel" }, { key: "telugu", label: "తెలుగు" }, { key: "english", label: "English" }];

export default function Bible() {
  const { c, prefs, setPrefs } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: ReadingMode }>();
  React.useEffect(() => { if (params.mode && params.mode !== prefs.readingMode) setPrefs({ readingMode: params.mode }); }, [params.mode]);
  const [testament, setTestament] = useState<Testament>("OT");
  const [open, setOpen] = useState<string | null>(null);
  const books = useMemo(() => BOOKS.filter((b) => b.testament === testament), [testament]);
  const { db } = useBibleDb();
  const [names, setNames] = useState<BookNames | null>(null);
  React.useEffect(() => { if (db) loadBookNames(db).then(setNames).catch(() => {}); }, [db]);

  const Segment = ({ items, value, onChange }: { items: { key: string; label: string }[]; value: string; onChange: (k: any) => void }) => (
    <View style={{ flexDirection: "row", backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 3 }} accessibilityRole="tablist">
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: on ? c.surface : "transparent" }}>
            <Text style={{ fontFamily: /[ఀ-౿]/.test(it.label) ? fonts.teluguUiBold : fonts.uiBold, fontSize: 13.5, color: on ? c.primary : c.textMuted }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderBook = ({ item }: { item: BookMeta }) => {
    const expanded = open === item.code;
    return (
      <View style={{ borderBottomWidth: 0.5, borderBottomColor: c.border }}>
        <Pressable onPress={() => setOpen(expanded ? null : item.code)} accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.chapters} chapters`} accessibilityState={{ expanded }}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ width: 34, fontFamily: fonts.ui, fontSize: 12.5, color: c.textMuted }}>{item.order}</Text>
          <View style={{ flex: 1 }}>
            {prefs.readingMode !== "english" && names?.[TE]?.[item.code] ? <Text style={{ fontFamily: fonts.teluguUiBold, fontSize: 16, color: c.text, lineHeight: 26 }}>{names[TE][item.code].name}</Text> : null}
            <Text style={{ fontFamily: prefs.readingMode === "english" ? fonts.uiMedium : fonts.ui, fontSize: prefs.readingMode === "english" ? 16.5 : 13, color: prefs.readingMode === "english" ? c.text : c.textMuted }}>{item.name}</Text>
          </View>
          <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted, marginRight: 8 }}>{item.chapters}</Text>
          <View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}><Icon name="chevron" color={c.textMuted} size={16} /></View>
        </Pressable>
        {expanded ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 16, paddingLeft: 34 }}>
            {Array.from({ length: item.chapters }, (_, i) => i + 1).map((ch) => (
              <Pressable key={ch} onPress={() => router.push(`/read/${item.code}/${ch}`)} accessibilityRole="button" accessibilityLabel={`${item.name} chapter ${ch}`}
                style={({ pressed }) => ({ width: 46, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.goldSoft : c.surface, borderWidth: 0.5, borderColor: c.border })}>
                <Text style={{ fontFamily: fonts.uiMedium, fontSize: 15, color: c.text }}>{ch}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 34, color: c.text }}>Holy Bible</Text>
        <Text style={{ fontFamily: fonts.teluguUi, fontSize: 14, color: c.gold, marginBottom: 14 }}>పరిశుద్ధ గ్రంథము</Text>
        <Segment items={MODES} value={prefs.readingMode} onChange={(m) => setPrefs({ readingMode: m })} />
        <View style={{ height: 10 }} />
        <Segment items={[{ key: "OT", label: "Old Testament · 39" }, { key: "NT", label: "New Testament · 27" }]} value={testament} onChange={(t) => { setTestament(t); setOpen(null); }} />
      </View>
      <FlatList data={books} keyExtractor={(b) => b.code} renderItem={renderBook} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30, paddingTop: 6 }} />
    </View>
  );
}
