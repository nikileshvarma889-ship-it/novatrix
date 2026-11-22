import React from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Card, EmptyState, Screen, SectionHeader, Title } from "../../components/ui";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/typography";
import { useQuery } from "../../lib/userdata";
import { parseRef, displayRef } from "../../lib/ref";

type Bm = { id: string; kind: "verse" | "chapter"; ref: string; favourite: number };

export default function Bookmarks() {
  const { c } = useTheme();
  const { rows, error } = useQuery<Bm>("SELECT id, kind, ref, favourite FROM bookmarks WHERE deleted = 0 ORDER BY vid");
  const cols = useQuery<{ id: string; name: string; n: number }>("SELECT c.id, c.name, (SELECT COUNT(*) FROM collection_items i WHERE i.collection_id = c.id AND i.deleted = 0) AS n FROM collections c WHERE c.deleted = 0 ORDER BY c.name");
  const open = (ref: string) => { const r = parseRef(ref); if (r) router.push(`/read/${r.book}/${r.chapter}`); };
  return (
    <Screen>
      <Title sub="Favourite verses, saved chapters and collections">Bookmarks</Title>
      {error ? <Text style={{ color: c.danger }}>Couldn't load bookmarks: {error}</Text> : null}
      {rows && rows.length === 0 && cols.rows?.length === 0 ? (
        <EmptyState icon="bookmark" title="Nothing saved yet" body="Bookmark a verse or a whole chapter while reading, and group verses into collections like Faith, Hope or Promises of God (verse tools arrive in Phase 4)." action={{ label: "Open the Bible", onPress: () => router.push("/bible") }} />
      ) : null}
      {rows && rows.length ? <SectionHeader title="Saved" /> : null}
      {rows?.map((b) => {
        const r = parseRef(b.ref);
        return (
          <Card key={b.id} onPress={() => open(b.ref)} label={b.ref} style={{ marginBottom: 10 }}>
            <Text style={{ fontFamily: fonts.uiBold, fontSize: 16, color: c.text }}>{r ? displayRef(r.book, r.chapter, r.verse) : b.ref}{b.favourite ? "  ★" : ""}</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted }}>{b.kind === "chapter" ? "Saved chapter" : "Verse"}</Text>
          </Card>
        );
      })}
      {cols.rows && cols.rows.length ? <SectionHeader title="Collections" /> : null}
      {cols.rows?.map((col) => (
        <Card key={col.id} style={{ marginBottom: 10 }}><Text style={{ fontFamily: fonts.uiBold, fontSize: 16, color: c.text }}>{col.name}</Text><Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted }}>{col.n} verses</Text></Card>
      ))}
    </Screen>
  );
}
