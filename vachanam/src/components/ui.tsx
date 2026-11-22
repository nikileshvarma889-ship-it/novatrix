import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { Icon, type IconName } from "./Icon";

export function Screen({ children, scroll = true, padTop = true }: { children: React.ReactNode; scroll?: boolean; padTop?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const style = { paddingTop: padTop ? insets.top + 8 : 8, paddingHorizontal: 20, paddingBottom: 32 };
  return scroll
    ? <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={style}>{children}</ScrollView>
    : <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 34, color: c.text, letterSpacing: 0.3 }}>{children}</Text>
      {sub ? <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: c.textMuted, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 26, marginBottom: 10 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.uiBold, fontSize: 13, letterSpacing: 1.4, textTransform: "uppercase", color: c.textMuted }}>{title}</Text>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress, label }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; label?: string }) {
  const { c } = useTheme();
  const base: ViewStyle = { backgroundColor: c.surface, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, padding: 16 };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [base, style, { opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      {children}
    </Pressable>
  );
}

export function Row({ icon, title, subtitle, onPress, right, danger, badge }: { icon?: IconName; title: string; subtitle?: string; onPress?: () => void; right?: React.ReactNode; danger?: boolean; badge?: React.ReactNode }) {
  const { c } = useTheme();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 13, gap: 14 }}>
      {icon ? <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}><Icon name={icon} color={danger ? c.danger : c.primary} size={20} /></View> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.uiMedium, fontSize: 16, color: danger ? c.danger : c.text }}>{title}</Text>
        {subtitle ? <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted, marginTop: 2 }}>{subtitle}</Text> : null}
        {badge ? <View style={{ marginTop: 8 }}>{badge}</View> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron" color={c.textMuted} size={18} /> : null)}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{body}</Pressable> : body;
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: { label: string; onPress: () => void } }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.goldSoft, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <Icon name={icon} color={c.gold} size={28} />
      </View>
      <Text style={{ fontFamily: fonts.display, fontSize: 24, color: c.text, textAlign: "center" }}>{title}</Text>
      <Text style={{ fontFamily: fonts.ui, fontSize: 14.5, lineHeight: 21, color: c.textMuted, textAlign: "center", marginTop: 6, maxWidth: 320 }}>{body}</Text>
      {action ? <Button label={action.label} onPress={action.onPress} style={{ marginTop: 18 }} /> : null}
    </View>
  );
}

export function Button({ label, onPress, variant = "primary", style, disabled }: { label: string; onPress: () => void; variant?: "primary" | "ghost"; style?: ViewStyle; disabled?: boolean } & Omit<PressableProps, "style">) {
  const { c } = useTheme();
  const primary = variant === "primary";
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [{ backgroundColor: primary ? c.primary : "transparent", borderWidth: primary ? 0 : 1, borderColor: c.border, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 14, alignItems: "center", opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}>
      <Text style={{ fontFamily: fonts.uiBold, fontSize: 15, color: primary ? c.primaryText : c.primary }}>{label}</Text>
    </Pressable>
  );
}

/** Honest marker for sections whose content arrives in a later build phase. */
export function PhaseBadge({ phase, text }: { phase: number; text?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: c.goldSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.uiMedium, fontSize: 11.5, color: c.gold }}>{text ?? `Coming in Phase ${phase}`}</Text>
    </View>
  );
}

/** Removes the browser focus ring on web text inputs (native platforms have none). */
export const noOutline = (Platform.OS === "web" ? { outlineStyle: "none" } : {}) as object;
