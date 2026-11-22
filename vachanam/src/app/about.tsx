import React from "react";
import { Linking, Text, View } from "react-native";
import { Card, Screen, SectionHeader } from "../components/ui";
import { Logo } from "../components/Logo";
import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { useBibleDb } from "../bible/BibleProvider";
import { loadTranslations, type Translation } from "../bible/repo";

function P({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <Text style={{ fontFamily: fonts.ui, fontSize: 14.5, lineHeight: 22, color: c.text, marginBottom: 8 }}>{children}</Text>;
}

export default function About() {
  const { c } = useTheme();
  const { db } = useBibleDb();
  const [tr, setTr] = React.useState<Translation[] | null>(null);
  React.useEffect(() => { if (db) loadTranslations(db).then(setTr).catch(() => setTr([])); }, [db]);
  return (
    <Screen padTop={false}>
      <View style={{ alignItems: "center", marginVertical: 18 }}>
        <Logo size={84} bg={c.primary === "#86BFA0" ? "#1F4D3A" : c.primary} gold={c.gold} />
        <Text style={{ fontFamily: fonts.display, fontSize: 34, color: c.text, marginTop: 10 }}>Vachanam</Text>
        <Text style={{ fontFamily: fonts.teluguUi, fontSize: 15, color: c.gold }}>వచనం</Text>
        <Text style={{ fontFamily: fonts.displayItalic, fontSize: 18, color: c.textMuted, marginTop: 4 }}>Read. Understand. Live the Word.</Text>
        <Text style={{ fontFamily: fonts.ui, fontSize: 12.5, color: c.textMuted, marginTop: 6 }}>Version 1.0.0</Text>
      </View>
      <SectionHeader title="Our promise" />
      <Card>
        <P>Vachanam is a free Telugu and English Bible for daily reading, study and prayer. It works offline, keeps your notes private and never shows ads inside Scripture.</P>
        <P>Bible text comes only from translations whose licences allow free distribution. Nothing is invented or altered.</P>
      </Card>
      <SectionHeader title="Bible translations" />
      {(tr ?? []).map((t) => (
        <Card key={t.id} style={{ marginBottom: 10 }}>
          <Text style={{ fontFamily: t.language === "te" ? fonts.teluguUiBold : fonts.uiBold, fontSize: 16, color: c.text, lineHeight: 26 }}>{t.name}</Text>
          <Text style={{ fontFamily: fonts.uiMedium, fontSize: 12.5, color: c.gold, marginBottom: 6 }}>{t.license}</Text>
          <P>{t.copyright}</P>
          <Text onPress={() => Linking.openURL(t.source_url)} accessibilityRole="link" style={{ fontFamily: fonts.uiMedium, fontSize: 14, color: c.primary }}>Source and licence details</Text>
          {t.license.startsWith("CC BY-SA") ? <Text onPress={() => Linking.openURL("https://creativecommons.org/licenses/by-sa/4.0/")} accessibilityRole="link" style={{ fontFamily: fonts.uiMedium, fontSize: 14, color: c.primary, marginTop: 6 }}>Read the CC BY-SA 4.0 licence</Text> : null}
        </Card>
      ))}
      <SectionHeader title="Fonts" />
      <Card><P>Noto Serif Telugu, Noto Sans Telugu, Cormorant Garamond and Inter, all under the SIL Open Font License 1.1.</P></Card>
    </Screen>
  );
}
