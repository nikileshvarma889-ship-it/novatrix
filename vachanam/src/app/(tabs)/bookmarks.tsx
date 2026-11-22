import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Card, EmptyState, Row, Screen, SectionHeader, Title } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { VerseCard } from "../../components/VerseCard";
import { COLLECTION_TE } from "../../components/reader/CollectionPicker";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/typography";
import { listCollections, removeBookmark, setFavourite, type Collection } from "../../lib/marks";
import { parseRef } from "../../lib/ref";
import { useVerseTexts } from "../../bible/preview";
import { BOOK_BY_CODE } from "../../data/books";

type Bm = { id: string; kind: "verse" | "chapter"; ref: string; vid: number; favourite: number };

export default function Bookmarks() {
  const { c } = useTheme();
  const db = useSQLiteContext();
  const [bms, setBms] = useState<Bm[] | null>(null);
  const [cols, setCols] = useState<Collection[]>([]);
  const [hl, setHl] = useState(0);
  const load = useCallback(() => {
    db.getAllAsync<Bm>("SELECT id, kind, ref, vid, favourite FROM bookmarks WHERE deleted = 0 ORDER BY favourite DESC, vid").then(setBms).catch(() => setBms([]));
    listCollections(db).then(setCols).catch(() => {});
    db.getFirstAsync<{ n: number }>("SELECT COUNT(*) n FROM highlights WHERE deleted = 0").then((r) => setHl(r?.n ?? 0)).catch(() => {});
  }, [db]);
  useFocusEffect(load);
  const verses = (bms ?? []).filter((b) => b.kind === "verse");
  const chapters = (bms ?? []).filter((b) => b.kind === "chapter");
  const texts = useVerseTexts(verses.map((b) => b.vid));
  const favs = verses.filter((b) => b.favourite), others = verses.filter((b) => !b.favourite);
  const card = (b: Bm) => (
    <VerseCard key={b.id} refStr={b.ref} te={texts[b.vid]?.te} en={texts[b.vid]?.en} actions={[
      { icon: "star", label: b.favourite ? "Remove from favourites" : "Add to favourites", on: !!b.favourite, onPress: () => setFavourite(db, b.id, !b.favourite).then(load) },
      { icon: "trash", label: "Remove bookmark", onPress: () => removeBookmark(db, b.id).then(load) },
    ]} />
  );
  return (
    <Screen>
      <Title sub="Favourite verses, saved chapters and collections">Bookmarks</Title>
      {bms && !verses.length && !chapters.length ? (
        <Card style={{ marginBottom: 6 }}>
          <Text style={{ fontFamily: fonts.ui, fontSize: 14, lineHeight: 21, color: c.textMuted }}>Tap any verse while reading and choose Bookmark, or tap the bookmark at the top of a chapter to save the whole chapter.</Text>
        </Card>
      ) : null}
      {favs.length ? <SectionHeader title={`★ Favourites · ${favs.length}`} /> : null}
      {favs.map(card)}
      {others.length ? <SectionHeader title={`Saved verses · ${others.length}`} /> : null}
      {others.map(card)}
      {chapters.length ? <SectionHeader title={`Saved chapters · ${chapters.length}`} /> : null}
      {chapters.length ? (
        <Card style={{ paddingVertical: 4 }}>
          {chapters.map((b, i) => {
            const r = parseRef(b.ref)!;
            return (
              <View key={b.id} style={{ flexDirection: "row", alignItems: "center", borderTopWidth: i ? 0.5 : 0, borderTopColor: c.border }}>
                <View style={{ flex: 1 }}><Row icon="book" title={`${BOOK_BY_CODE[r.book].name} ${r.chapter}`} onPress={() => router.push(`/read/${r.book}/${r.chapter}`)} /></View>
                <Pressable onPress={() => removeBookmark(db, b.id).then(load)} accessibilityRole="button" accessibilityLabel={`Remove ${BOOK_BY_CODE[r.book].name} ${r.chapter}`} style={{ padding: 8 }}><Icon name="trash" color={c.textMuted} size={18} /></Pressable>
              </View>
            );
          })}
        </Card>
      ) : null}

      <SectionHeader title="Collections" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {cols.map((col) => (
          <Card key={col.id} onPress={() => router.push(`/collection/${col.id}`)} label={`${col.name}, ${col.n} verses`} style={{ width: "48%", padding: 14 }}>
            <Icon name="folder" color={c.gold} size={22} />
            <Text style={{ fontFamily: fonts.uiBold, fontSize: 15, color: c.text, marginTop: 8 }} numberOfLines={1}>{col.name}</Text>
            {COLLECTION_TE[col.id] ? <Text style={{ fontFamily: fonts.teluguUi, fontSize: 12.5, color: c.textMuted }}>{COLLECTION_TE[col.id]}</Text> : null}
            <Text style={{ fontFamily: fonts.ui, fontSize: 12.5, color: c.textMuted, marginTop: 2 }}>{col.n} {col.n === 1 ? "verse" : "verses"}</Text>
          </Card>
        ))}
      </View>
      <Text style={{ fontFamily: fonts.ui, fontSize: 12.5, color: c.textMuted, marginTop: 8 }}>Add verses from the reader with Collection. You can create new collections there too.</Text>

      <SectionHeader title="Highlights" />
      <Card style={{ paddingVertical: 4 }}>
        <Row icon="underline" title="Manage highlights" subtitle={`${hl} highlighted ${hl === 1 ? "verse" : "verses"} · filter by colour, remove`} onPress={() => router.push("/highlights")} />
      </Card>
      {bms === null ? null : !verses.length && !chapters.length && !cols.some((x) => x.n) && !hl ? <EmptyState icon="bookmark" title="Start saving verses" body="Your bookmarks, favourites, collections and highlights will appear here." action={{ label: "Open the Bible", onPress: () => router.push("/bible") }} /> : null}
    </Screen>
  );
}
