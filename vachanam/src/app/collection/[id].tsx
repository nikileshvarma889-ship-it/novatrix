import React, { useCallback, useState } from "react";
import { Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Button, EmptyState, noOutline, Screen } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { VerseCard } from "../../components/VerseCard";
import { COLLECTION_TE } from "../../components/reader/CollectionPicker";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/typography";
import { deleteCollection, removeFromCollection, renameCollection } from "../../lib/marks";
import { useVerseTexts } from "../../bible/preview";

export default function CollectionScreen() {
  const { c } = useTheme();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState<string | null>(null);
  const [items, setItems] = useState<{ ref: string; vid: number }[] | null>(null);
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState("");
  const load = useCallback(() => {
    db.getFirstAsync<{ name: string }>("SELECT name FROM collections WHERE id = ? AND deleted = 0", [id]).then((r) => setName(r?.name ?? "")).catch(() => {});
    db.getAllAsync<{ ref: string; vid: number }>("SELECT ref, vid FROM collection_items WHERE collection_id = ? AND deleted = 0 ORDER BY vid", [id]).then(setItems).catch(() => setItems([]));
  }, [db, id]);
  useFocusEffect(load);
  const texts = useVerseTexts(items?.map((i) => i.vid) ?? null);
  const del = () => {
    const go = async () => { await deleteCollection(db, id); router.back(); };
    if (Platform.OS === "web") { if (globalThis.confirm?.(`Delete the collection "${name}"? The verses stay in your Bible.`)) go(); return; }
    Alert.alert("Delete collection?", "The verses stay in your Bible; only this list is removed.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: go }]);
  };
  if (name === "") return <Screen padTop={false}><EmptyState icon="folder" title="Collection not found" body="It may have been deleted." /></Screen>;
  return (
    <Screen padTop={false}>
      <Stack.Screen options={{ title: name ?? "", headerRight: () => (
        <View style={{ flexDirection: "row" }}>
          <Pressable onPress={() => { setDraft(name ?? ""); setEditing(true); }} accessibilityRole="button" accessibilityLabel="Rename collection" style={{ padding: 8 }}><Icon name="text" color={c.primary} size={20} /></Pressable>
          <Pressable onPress={del} accessibilityRole="button" accessibilityLabel="Delete collection" style={{ padding: 8 }}><Icon name="trash" color={c.danger} size={20} /></Pressable>
        </View>) }} />
      {COLLECTION_TE[id] ? <Text style={{ fontFamily: fonts.teluguUiBold, fontSize: 16, color: c.gold, marginBottom: 10 }}>{COLLECTION_TE[id]}</Text> : null}
      {editing ? (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <TextInput value={draft} onChangeText={setDraft} autoFocus accessibilityLabel="Collection name" style={[noOutline, { flex: 1, backgroundColor: c.surface, borderRadius: 12, borderWidth: 0.5, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.ui, fontSize: 15, color: c.text }]} />
          <Button label="Save" disabled={!draft.trim()} onPress={async () => { await renameCollection(db, id, draft); setEditing(false); load(); }} />
        </View>
      ) : null}
      {items && !items.length ? <EmptyState icon="folder" title="No verses yet" body="While reading, tap a verse, choose Collection, and pick this one." /> : null}
      {items?.map((it) => (
        <VerseCard key={it.ref} refStr={it.ref} te={texts[it.vid]?.te} en={texts[it.vid]?.en}
          actions={[{ icon: "trash", label: `Remove ${it.ref} from collection`, onPress: () => removeFromCollection(db, id, it.ref).then(load) }]} />
      ))}
    </Screen>
  );
}
