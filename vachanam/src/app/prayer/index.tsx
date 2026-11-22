import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Button, Card, EmptyState, Screen } from "../../components/ui";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/typography";
import { useQuery } from "../../lib/userdata";
import { nowIso, uuid } from "../../lib/id";

type Prayer = { id: string; title: string; body: string; answered: number; updated_at: string };

export default function PrayerList() {
  const { c } = useTheme();
  const db = useSQLiteContext();
  const { rows, error } = useQuery<Prayer>("SELECT id, title, body, answered, updated_at FROM prayers WHERE deleted = 0 ORDER BY answered, updated_at DESC");
  const create = async () => {
    const id = uuid(), t = nowIso();
    await db.runAsync("INSERT INTO prayers (id, title, body, created_at, updated_at) VALUES (?, '', '', ?, ?)", [id, t, t]);
    router.push(`/prayer/${id}`);
  };
  return (
    <Screen padTop={false}>
      <Text style={{ fontFamily: fonts.displayItalic, fontSize: 18, color: c.textMuted, marginBottom: 14 }}>Pour out your heart. Return and give thanks.</Text>
      <Button label="New prayer" onPress={create} style={{ marginBottom: 16 }} />
      {error ? <Text style={{ color: c.danger }}>Couldn't load prayers: {error}</Text> : null}
      {rows && rows.length === 0 ? <EmptyState icon="pray" title="Your journal is empty" body="Write a prayer, come back to it, and mark it answered. Prayers stay private on this device." /> : null}
      {rows?.map((p) => (
        <Card key={p.id} onPress={() => router.push(`/prayer/${p.id}`)} label={p.title || "Untitled prayer"} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ flex: 1, fontFamily: fonts.uiBold, fontSize: 16, color: c.text }}>{p.title || "Untitled prayer"}</Text>
            {p.answered ? <Text style={{ fontFamily: fonts.uiMedium, fontSize: 12, color: c.primary }}>Answered ✓</Text> : null}
          </View>
          {p.body ? <Text numberOfLines={2} style={{ fontFamily: /[ఀ-౿]/.test(p.body) ? fonts.teluguUi : fonts.ui, fontSize: 14, color: c.textMuted, marginTop: 4 }}>{p.body}</Text> : null}
          <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: c.textMuted, marginTop: 6 }}>{new Date(p.updated_at).toLocaleDateString()}</Text>
        </Card>
      ))}
    </Screen>
  );
}
