import React, { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/typography";
import { Icon } from "../../components/Icon";
import { noOutline } from "../../components/ui";
import { nowIso } from "../../lib/id";

/** Prayer editor: autosaves 600 ms after typing stops, and again when leaving the screen. */
export default function PrayerEditor() {
  const { c } = useTheme();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [answered, setAnswered] = useState(false);
  const [state, setState] = useState<"loading" | "saved" | "saving" | "missing" | "error">("loading");
  const latest = useRef({ title, body, answered }); latest.current = { title, body, answered };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    db.getFirstAsync<{ title: string; body: string; answered: number }>("SELECT title, body, answered FROM prayers WHERE id = ? AND deleted = 0", [id])
      .then((r) => { if (!r) return setState("missing"); setTitle(r.title); setBody(r.body); setAnswered(!!r.answered); loaded.current = true; setState("saved"); })
      .catch(() => setState("error"));
  }, [db, id]);

  const save = async () => {
    const v = latest.current;
    try { await db.runAsync("UPDATE prayers SET title = ?, body = ?, answered = ?, updated_at = ? WHERE id = ?", [v.title, v.body, v.answered ? 1 : 0, nowIso(), id]); setState("saved"); }
    catch { setState("error"); }
  };
  useEffect(() => {
    if (!loaded.current) return;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 600);
  }, [title, body, answered]);
  // flush on leave; drop an untouched empty prayer instead of keeping a blank row
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (!loaded.current) return;
    const v = latest.current;
    if (!v.title.trim() && !v.body.trim()) db.runAsync("DELETE FROM prayers WHERE id = ?", [id]).catch(() => {});
    else save();
  }, []);

  const remove = () => {
    const doIt = async () => { loaded.current = false; await db.runAsync("UPDATE prayers SET deleted = 1, updated_at = ? WHERE id = ?", [nowIso(), id]); router.back(); };
    if (Platform.OS === "web") { if (globalThis.confirm?.("Delete this prayer?")) doIt(); return; }
    Alert.alert("Delete prayer?", "This can't be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: doIt }]);
  };

  if (state === "missing") return <View style={{ flex: 1, backgroundColor: c.bg, padding: 24 }}><Text style={{ fontFamily: fonts.ui, color: c.textMuted }}>This prayer no longer exists.</Text></View>;
  const isTe = (s: string) => /[ఀ-౿]/.test(s);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ headerRight: () => <Pressable onPress={remove} accessibilityLabel="Delete prayer" style={{ padding: 8 }}><Icon name="trash" color={c.danger} size={20} /></Pressable> }} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={c.textMuted} accessibilityLabel="Prayer title"
          style={[noOutline, { fontFamily: isTe(title) ? fonts.teluguUiBold : fonts.display, fontSize: 28, color: c.text, paddingVertical: 6 }]} />
        <TextInput value={body} onChangeText={setBody} placeholder="Write your prayer… మీ ప్రార్థన రాయండి" placeholderTextColor={c.textMuted} multiline accessibilityLabel="Prayer text"
          style={[noOutline, { fontFamily: isTe(body) ? fonts.teluguUi : fonts.ui, fontSize: 17, lineHeight: 27, color: c.text, minHeight: 240, textAlignVertical: "top", marginTop: 8 }]} />
        <Pressable onPress={() => setAnswered(!answered)} accessibilityRole="checkbox" accessibilityState={{ checked: answered }}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20, padding: 14, borderRadius: 14, backgroundColor: answered ? c.goldSoft : c.surface, borderWidth: 0.5, borderColor: c.border }}>
          <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: c.primary, backgroundColor: answered ? c.primary : "transparent", alignItems: "center", justifyContent: "center" }}>{answered ? <Icon name="check" color={c.primaryText} size={16} strokeWidth={2.2} /> : null}</View>
          <Text style={{ fontFamily: fonts.uiMedium, fontSize: 15, color: c.text }}>Answered prayer</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.ui, fontSize: 12.5, color: state === "error" ? c.danger : c.textMuted, marginTop: 14 }}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved on this device" : state === "error" ? "Couldn't save. Your text is still here; try again." : ""}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
