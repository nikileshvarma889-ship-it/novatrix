import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Logo } from "../../components/Logo";
import { Icon, type IconName } from "../../components/Icon";
import { Card, PhaseBadge, Screen, SectionHeader } from "../../components/ui";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/typography";
import { useQuery } from "../../lib/userdata";
import { BOOK_BY_CODE } from "../../data/books";

function greetingFor(h: number) {
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Tile({ icon, title, value, onPress }: { icon: IconName; title: string; value?: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Card onPress={onPress} label={title} style={{ flex: 1, padding: 14, minHeight: 96, justifyContent: "space-between" }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}><Icon name={icon} color={c.primary} size={19} /></View>
      <View>
        <Text style={{ fontFamily: fonts.uiBold, fontSize: 14.5, color: c.text }}>{title}</Text>
        {value ? <Text style={{ fontFamily: fonts.ui, fontSize: 12.5, color: c.textMuted, marginTop: 1 }}>{value}</Text> : null}
      </View>
    </Card>
  );
}

export default function Home() {
  const { c } = useTheme();
  const counts = useQuery<{ notes: number; bookmarks: number; history: number; prayers: number }>(
    `SELECT (SELECT COUNT(*) FROM notes WHERE deleted = 0) AS notes, (SELECT COUNT(*) FROM bookmarks WHERE deleted = 0) AS bookmarks,
            (SELECT COUNT(*) FROM reading_history) AS history, (SELECT COUNT(*) FROM prayers WHERE deleted = 0) AS prayers`);
  const last = useQuery<{ book: string; chapter: number }>("SELECT book, chapter FROM reading_history ORDER BY read_at DESC LIMIT 1");
  const installed = useQuery<{ n: number }>("SELECT COUNT(*) AS n FROM translations WHERE installed_at IS NOT NULL");
  const n = counts.rows?.[0];
  const lastRead = last.rows?.[0];
  const hasBible = (installed.rows?.[0]?.n ?? 0) > 0;
  const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;

  return (
    <Screen>
      {/* brand */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
        <Logo size={48} bg={c.primary === "#86BFA0" ? "#1F4D3A" : c.primary} gold={c.gold} />
        <View>
          <Text style={{ fontFamily: fonts.display, fontSize: 30, color: c.text, lineHeight: 34 }}>Vachanam</Text>
          <Text style={{ fontFamily: fonts.teluguUi, fontSize: 13, color: c.gold }}>వచనం · Telugu & English Holy Bible</Text>
        </View>
      </View>

      {/* greeting */}
      <View style={{ marginTop: 26 }}>
        <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: c.textMuted }}>{greetingFor(new Date().getHours())}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 40, color: c.text, lineHeight: 46 }}>God Bless You</Text>
        <Text style={{ fontFamily: fonts.displayItalic, fontSize: 18, color: c.textMuted }}>Read. Understand. Live the Word.</Text>
      </View>

      {/* daily verse */}
      <SectionHeader title="Verse of the day" />
      <View style={{ backgroundColor: c.primary === "#86BFA0" ? "#173B2D" : c.primary, borderRadius: 22, padding: 20, overflow: "hidden" }}>
        <View style={{ position: "absolute", right: -30, top: -30, opacity: 0.12 }}><Logo size={150} bg="transparent" gold="#F3E7C9" /></View>
        <Text style={{ fontFamily: fonts.uiBold, fontSize: 11.5, letterSpacing: 1.6, color: "#E6CF94" }}>తెలుగు · ENGLISH</Text>
        {hasBible ? null : (
          <>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: "#FFFDF8", marginTop: 10, lineHeight: 30 }}>Your daily verse will appear here</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 14, lineHeight: 21, color: "#DCE6DF", marginTop: 8 }}>
              Each morning Vachanam shows one verse in Telugu and English together. It starts once the licensed Bible texts are installed.
            </Text>
            <View style={{ marginTop: 14 }}><PhaseBadge phase={2} text="Bible text arrives in Phase 2" /></View>
          </>
        )}
      </View>

      {/* continue reading */}
      <SectionHeader title="Continue reading" />
      <Card onPress={() => (lastRead ? router.push(`/read/${lastRead.book}/${lastRead.chapter}`) : router.push("/bible"))} label="Continue reading">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.goldSoft, alignItems: "center", justifyContent: "center" }}><Icon name="book" color={c.gold} size={24} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.uiBold, fontSize: 16, color: c.text }}>{lastRead ? `${BOOK_BY_CODE[lastRead.book]?.name} ${lastRead.chapter}` : "Begin your reading"}</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted, marginTop: 2 }}>{lastRead ? "Pick up where you left off" : "Choose any of the 66 books"}</Text>
          </View>
          <Icon name="chevron" color={c.textMuted} size={18} />
        </View>
      </Card>

      {/* quick access */}
      <SectionHeader title="Read the Bible" />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Card onPress={() => router.push({ pathname: "/bible", params: { mode: "telugu" } })} label="Telugu Bible" style={{ flex: 1, padding: 18 }}>
          <Text style={{ fontFamily: fonts.teluguScriptureBold, fontSize: 20, color: c.primary, lineHeight: 34 }}>తెలుగు బైబిల్</Text>
          <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted }}>Telugu Bible</Text>
        </Card>
        <Card onPress={() => router.push({ pathname: "/bible", params: { mode: "english" } })} label="English Bible" style={{ flex: 1, padding: 18 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: c.accent, lineHeight: 34 }}>English Bible</Text>
          <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted }}>Parallel with Telugu</Text>
        </Card>
      </View>

      {/* my library */}
      <SectionHeader title="My library" />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Tile icon="bookmark" title="Bookmarks" value={n ? plural(n.bookmarks, "verse") : " "} onPress={() => router.push("/bookmarks")} />
        <Tile icon="note" title="My Notes" value={n ? plural(n.notes, "note") : " "} onPress={() => router.push("/notes")} />
        <Tile icon="history" title="History" value={n ? plural(n.history, "chapter") : " "} onPress={() => router.push("/history")} />
      </View>

      {/* devotional & prayer */}
      <SectionHeader title="Grow in faith" />
      <Card onPress={() => router.push("/prayer")} label="Prayer Journal" style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}><Icon name="pray" color={c.primary} size={24} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.uiBold, fontSize: 16, color: c.text }}>Prayer Journal</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted, marginTop: 2 }}>{n && n.prayers ? `${plural(n.prayers, "prayer")} · write, revisit, mark answered` : "Write your prayers and mark them answered"}</Text>
          </View>
          <Icon name="chevron" color={c.textMuted} size={18} />
        </View>
      </Card>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}><Icon name="devotional" color={c.primary} size={24} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.uiBold, fontSize: 16, color: c.text }}>Daily Devotional</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted, marginTop: 2, marginBottom: 8 }}>Short daily reflections in Telugu and English.</Text>
            <PhaseBadge phase={7} text="Needs a licensed devotional source" />
          </View>
        </View>
      </Card>
    </Screen>
  );
}
