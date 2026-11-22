import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/typography";
import { Icon } from "../Icon";
import { Button, noOutline } from "../ui";
import { createCollection, listCollections, type Collection } from "../../lib/marks";

export const COLLECTION_TE: Record<string, string> = { "col-faith": "విశ్వాసం", "col-prayer": "ప్రార్థన", "col-hope": "నిరీక్షణ", "col-love": "ప్రేమ", "col-promises": "దేవుని వాగ్దానాలు" };

/** Bottom sheet to choose (or create) a collection. */
export function CollectionPicker({ visible, onClose, onPick, label }: { visible: boolean; onClose: () => void; onPick: (id: string, name: string) => void; label: string }) {
  const { c } = useTheme();
  const db = useSQLiteContext();
  const [cols, setCols] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  useEffect(() => { if (visible) listCollections(db).then(setCols).catch(() => {}); }, [visible, db]);
  const create = async () => { if (!name.trim()) return; const id = await createCollection(db, name); setName(""); onPick(id, name.trim()); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28, maxHeight: "70%" }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 24, color: c.text }}>Save to collection</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ padding: 6 }}><Icon name="close" color={c.textMuted} size={20} /></Pressable>
        </View>
        <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted, marginBottom: 8 }}>{label}</Text>
        <ScrollView>
          {cols.map((col) => (
            <Pressable key={col.id} onPress={() => onPick(col.id, col.name)} accessibilityRole="button" accessibilityLabel={`Add to ${col.name}`}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1, borderBottomWidth: 0.5, borderBottomColor: c.border })}>
              <Icon name="folder" color={c.gold} size={20} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.uiMedium, fontSize: 15.5, color: c.text }}>{col.name}</Text>
                {COLLECTION_TE[col.id] ? <Text style={{ fontFamily: fonts.teluguUi, fontSize: 12.5, color: c.textMuted }}>{COLLECTION_TE[col.id]}</Text> : null}
              </View>
              <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: c.textMuted }}>{col.n}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14, alignItems: "center" }}>
          <TextInput value={name} onChangeText={setName} placeholder="New collection name" placeholderTextColor={c.textMuted} accessibilityLabel="New collection name"
            style={[noOutline, { flex: 1, backgroundColor: c.bg, borderRadius: 12, borderWidth: 0.5, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 10, fontFamily: fonts.ui, fontSize: 15, color: c.text }]} />
          <Button label="Create" onPress={create} disabled={!name.trim()} />
        </View>
      </View>
    </Modal>
  );
}
