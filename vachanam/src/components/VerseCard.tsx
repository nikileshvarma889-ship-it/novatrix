import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { Card } from "./ui";
import { Icon, type IconName } from "./Icon";
import { displayRef, parseRef } from "../lib/ref";

/** A saved verse: reference, Telugu + English preview, opens the reader at that verse. */
export function VerseCard({ refStr, te, en, bg, actions }: { refStr: string; te?: string; en?: string; bg?: string; actions?: { icon: IconName; label: string; onPress: () => void; on?: boolean }[] }) {
  const { c } = useTheme();
  const r = parseRef(refStr);
  if (!r) return null;
  const label = displayRef(r.book, r.chapter, r.verse);
  return (
    <Card onPress={() => router.push(`/read/${r.book}/${r.chapter}${r.verse ? `?v=${r.verse}` : ""}`)} label={`Open ${label}`} style={{ marginBottom: 10, backgroundColor: bg ?? c.surface }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ flex: 1, fontFamily: fonts.uiBold, fontSize: 14, color: c.gold }}>{label}</Text>
        {actions?.map((a) => (
          <Pressable key={a.label} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label} accessibilityState={a.on !== undefined ? { selected: a.on } : undefined} hitSlop={8} style={{ paddingHorizontal: 6 }}>
            <Icon name={a.icon} color={a.on ? c.gold : c.textMuted} size={19} />
          </Pressable>
        ))}
      </View>
      {te ? <Text numberOfLines={3} style={{ fontFamily: fonts.teluguScripture, fontSize: 15, lineHeight: 26, color: c.text, marginTop: 6 }}>{te}</Text> : null}
      {en ? <Text numberOfLines={3} style={{ fontFamily: fonts.englishScripture, fontSize: 16.5, lineHeight: 22, color: c.textMuted, marginTop: 4 }}>{en}</Text> : null}
    </Card>
  );
}
