import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { HIGHLIGHTS, type HighlightColor } from "../../theme/colors";
import { fonts } from "../../theme/typography";
import { Icon, type IconName } from "../Icon";

export type Action = "underline" | "note" | "bookmark" | "collection" | "copy" | "share";

/** Verse action menu shown while verses are selected. */
function Btn({ a, icon, text, on, onAction }: { a: Action; icon: IconName; text: string; on?: boolean; onAction: (a: Action) => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={() => onAction(a)} accessibilityRole="button" accessibilityLabel={text} accessibilityState={on !== undefined ? { selected: on } : undefined}
      style={({ pressed }) => ({ alignItems: "center", gap: 4, width: 68, paddingVertical: 6, borderRadius: 12, backgroundColor: on ? c.goldSoft : pressed ? c.surfaceAlt : "transparent" })}>
      <Icon name={icon} color={on ? c.gold : c.primary} size={21} />
      <Text style={{ fontFamily: fonts.uiMedium, fontSize: 11.5, color: c.text }}>{text}</Text>
    </Pressable>
  );
}

export function ActionBar(props: { label: string; current?: HighlightColor; underlined: boolean; bookmarked: boolean; onHighlight: (c: HighlightColor | null) => void; onAction: (a: Action) => void; onClose: () => void }) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ position: "absolute", left: 10, right: 10, bottom: 10, backgroundColor: c.surface, borderRadius: 20, borderWidth: 0.5, borderColor: c.border, paddingTop: 10, paddingBottom: 8, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, marginBottom: 8 }}>
        <Text style={{ flex: 1, fontFamily: fonts.uiBold, fontSize: 13.5, color: c.text }} numberOfLines={1}>{props.label}</Text>
        <Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Clear selection" style={{ padding: 4 }}><Icon name="close" color={c.textMuted} size={18} /></Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 14, marginBottom: 8, alignItems: "center" }} accessibilityLabel="Highlight colours">
        {(Object.keys(HIGHLIGHTS) as HighlightColor[]).map((k) => (
          <Pressable key={k} onPress={() => props.onHighlight(props.current === k ? null : k)} accessibilityRole="radio" accessibilityState={{ checked: props.current === k }} accessibilityLabel={`Highlight ${k}`}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: HIGHLIGHTS[k][isDark ? "dark" : "light"], borderWidth: props.current === k ? 2.5 : 1, borderColor: props.current === k ? c.primary : c.border, alignItems: "center", justifyContent: "center" }}>
            {props.current === k ? <Icon name="check" color={c.primary} size={16} strokeWidth={2.2} /> : null}
          </Pressable>
        ))}
        {props.current ? (
          <Pressable onPress={() => props.onHighlight(null)} accessibilityRole="button" accessibilityLabel="Remove highlight" style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ fontFamily: fonts.uiMedium, fontSize: 12.5, color: c.danger }}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 6 }}>
        <Btn onAction={props.onAction} a="underline" icon="underline" text="Underline" on={props.underlined} />
        <Btn onAction={props.onAction} a="note" icon="note" text="Add Note" />
        <Btn onAction={props.onAction} a="bookmark" icon={props.bookmarked ? "bookmarkFilled" : "bookmark"} text="Bookmark" on={props.bookmarked} />
        <Btn onAction={props.onAction} a="collection" icon="folder" text="Collection" />
        <Btn onAction={props.onAction} a="copy" icon="copy" text="Copy" />
        <Btn onAction={props.onAction} a="share" icon="share" text="Share" />
      </ScrollView>
    </View>
  );
}
