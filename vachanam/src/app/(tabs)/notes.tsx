import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Card, EmptyState, noOutline, Screen, Title } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/typography";
import { useQuery } from "../../lib/userdata";
import { displayRef } from "../../lib/ref";

type Note = { id: string; title: string; body: string; book: string; chapter: number; verse: number | null; updated_at: string };

export default function Notes() {
  const { c } = useTheme();
  const [q, setQ] = useState("");
  const like = `%${q.trim()}%`;
  const { rows, error } = useQuery<Note>("SELECT id, title, body, book, chapter, verse, updated_at FROM notes WHERE deleted = 0 AND (title LIKE ? OR body LIKE ?) ORDER BY updated_at DESC", [like, like]);
  return (
    <Screen>
      <Title sub="Your reflections, linked to the verses they belong to">My Notes</Title>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface, borderRadius: 14, borderWidth: 0.5, borderColor: c.border, paddingHorizontal: 12, marginBottom: 14 }}>
        <Icon name="search" color={c.textMuted} size={18} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search notes · నోట్స్ వెతకండి" placeholderTextColor={c.textMuted} accessibilityLabel="Search notes"
          style={[noOutline, { flex: 1, paddingVertical: 12, fontFamily: fonts.ui, fontSize: 15, color: c.text }]} />
      </View>
      {error ? <Text style={{ color: c.danger }}>Couldn't load notes: {error}</Text> : null}
      {rows && rows.length === 0 ? (
        <EmptyState icon="note" title={q ? "No matching notes" : "No notes yet"}
          body={q ? "Try another word." : "Notes are written from a verse or chapter while reading: tap a verse, then Add Note (arrives with the verse tools in Phase 4)."} />
      ) : null}
      {rows?.map((n) => (
        <Card key={n.id} style={{ marginBottom: 10 }}>
          <Text style={{ fontFamily: fonts.uiMedium, fontSize: 12, color: c.gold }}>{displayRef(n.book, n.chapter, n.verse ?? undefined)}</Text>
          <Text style={{ fontFamily: fonts.uiBold, fontSize: 16, color: c.text, marginTop: 2 }}>{n.title || "Untitled note"}</Text>
          <Text numberOfLines={3} style={{ fontFamily: /[ఀ-౿]/.test(n.body) ? fonts.teluguUi : fonts.ui, fontSize: 14, color: c.textMuted, marginTop: 4 }}>{n.body}</Text>
        </Card>
      ))}
    </Screen>
  );
}
