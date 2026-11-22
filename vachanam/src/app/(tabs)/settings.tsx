import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Card, Divider, PhaseBadge, Row, Screen, SectionHeader, Title } from "../../components/ui";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts, LINE_SPACINGS, READER_SIZES } from "../../theme/typography";
import type { ReadingMode, ThemeChoice } from "../../lib/prefs";

function Choice<T extends string | number>({ items, value, onChange, label }: { items: { key: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityLabel={label}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={String(it.key)} onPress={() => onChange(it.key)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${label}: ${it.label}`}
            style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }}>
            <Text style={{ fontFamily: /[ఀ-౿]/.test(it.label) ? fonts.teluguUiBold : fonts.uiMedium, fontSize: 13.5, color: on ? c.primaryText : c.text }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Settings() {
  const { c, prefs, setPrefs } = useTheme();
  const Label = ({ children }: { children: string }) => <Text style={{ fontFamily: fonts.uiMedium, fontSize: 14.5, color: c.text, marginBottom: 10, marginTop: 4 }}>{children}</Text>;
  return (
    <Screen>
      <Title sub="Make Vachanam yours">Settings</Title>

      <SectionHeader title="Appearance" />
      <Card>
        <Label>Theme</Label>
        <Choice<ThemeChoice> label="Theme" value={prefs.theme} onChange={(theme) => setPrefs({ theme })} items={[{ key: "system", label: "System" }, { key: "light", label: "Light" }, { key: "dark", label: "Dark" }]} />
      </Card>

      <SectionHeader title="Reading" />
      <Card>
        <Label>Default reading mode</Label>
        <Choice<ReadingMode> label="Reading mode" value={prefs.readingMode} onChange={(readingMode) => setPrefs({ readingMode })} items={[{ key: "parallel", label: "Parallel" }, { key: "telugu", label: "తెలుగు" }, { key: "english", label: "English" }]} />
        <View style={{ height: 16 }} />
        <Label>Parallel layout</Label>
        <Choice<"stacked" | "side"> label="Parallel layout" value={prefs.parallelLayout} onChange={(parallelLayout) => setPrefs({ parallelLayout })} items={[{ key: "stacked", label: "Stacked" }, { key: "side", label: "Side by side" }]} />
        <View style={{ height: 16 }} />
        <Label>Text size</Label>
        <Choice<number> label="Text size" value={prefs.readerSize} onChange={(readerSize) => setPrefs({ readerSize })} items={READER_SIZES.map((s) => ({ key: s, label: String(s) }))} />
        <View style={{ height: 16 }} />
        <Label>Line spacing</Label>
        <Choice<number> label="Line spacing" value={prefs.lineSpacing} onChange={(lineSpacing) => setPrefs({ lineSpacing })} items={LINE_SPACINGS.map((s) => ({ key: s, label: `${s}×` }))} />
        <View style={{ marginTop: 18, padding: 14, borderRadius: 12, backgroundColor: c.surfaceAlt }}>
          <Text style={{ fontFamily: fonts.uiMedium, fontSize: 11, letterSpacing: 1.2, color: c.textMuted, marginBottom: 6 }}>PREVIEW</Text>
          <Text style={{ fontFamily: fonts.teluguScripture, fontSize: prefs.readerSize, lineHeight: prefs.readerSize * prefs.lineSpacing, color: c.text }}>తెలుగు అక్షరాలు ఇలా కనిపిస్తాయి.</Text>
          <Text style={{ fontFamily: fonts.englishScripture, fontSize: prefs.readerSize + 1, lineHeight: prefs.readerSize * prefs.lineSpacing, color: c.text }}>English text will look like this.</Text>
        </View>
      </Card>

      <SectionHeader title="Bible translations" />
      <Card>
        <Row icon="globe" title="Telugu: Indian Revised Version (IRV) 2019" subtitle="CC BY-SA 4.0 · installed, works offline" onPress={() => router.push("/about")} />
        <Divider />
        <Row icon="globe" title="English: Berean Standard Bible (BSB)" subtitle="Public domain · installed, works offline" onPress={() => router.push("/about")} />
      </Card>

      <SectionHeader title="Daily verse" />
      <Card>
        <Row icon="bell" title="Daily verse notification" subtitle="Default 7:00 AM · only with your permission" badge={<PhaseBadge phase={5} />} />
      </Card>

      <SectionHeader title="Account" />
      <Card>
        <Row icon="user" title="Reading as Guest" subtitle="Everything is saved on this device. Sign-in and cloud sync are optional." badge={<PhaseBadge phase={6} />} />
      </Card>

      <SectionHeader title="About" />
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="shield" title="Privacy policy" onPress={() => router.push("/privacy")} />
        <Divider />
        <Row icon="info" title="About Vachanam" subtitle="Version 1.0.0 · translations and licences" onPress={() => router.push("/about")} />
      </Card>
    </Screen>
  );
}
