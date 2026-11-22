import React from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Card, EmptyState, Screen } from "../components/ui";
import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { useQuery } from "../lib/userdata";
import { BOOK_BY_CODE } from "../data/books";

export default function History() {
  const { c } = useTheme();
  const { rows, error } = useQuery<{ id: string; book: string; chapter: number; read_at: string }>("SELECT id, book, chapter, read_at FROM reading_history ORDER BY read_at DESC LIMIT 200");
  return (
    <Screen padTop={false}>
      {error ? <Text style={{ color: c.danger }}>Couldn’t load history: {error}</Text> : null}
      {rows && rows.length === 0 ? <EmptyState icon="history" title="No reading history yet" body="Chapters you read are listed here, newest first, so you can return to them." /> : null}
      {rows?.map((h) => (
        <Card key={h.id} onPress={() => router.push(`/read/${h.book}/${h.chapter}`)} label={`${BOOK_BY_CODE[h.book]?.name} ${h.chapter}`} style={{ marginBottom: 10 }}>
          <Text style={{ fontFamily: fonts.uiBold, fontSize: 16, color: c.text }}>{BOOK_BY_CODE[h.book]?.name} {h.chapter}</Text>
          <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted }}>{new Date(h.read_at).toLocaleString()}</Text>
        </Card>
      ))}
    </Screen>
  );
}
