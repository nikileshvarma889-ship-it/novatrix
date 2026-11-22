import React, { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useTheme } from "../../theme/ThemeProvider";
import { fonts } from "../../theme/typography";
import { Icon } from "../../components/Icon";
import { noOutline } from "../../components/ui";
import { deleteNote, updateNote } from "../../lib/marks";
import { displayRef, makeVid } from "../../lib/ref";
import { useBibleDb } from "../../bible/BibleProvider";
import { loadVerse } from "../../bible/repo";

type Note = { title: string; body: string; book: string; chapter: number; verse: number | null; created_at: string; updated_at: string };
const isTe = (s: string) => /[ఀ-౿]/.test(s);

/** Note editor: autosaves 600 ms after typing stops and when leaving; empty new notes are discarded. */
export default function NoteEditor() {
  const { c } = useTheme();
  const db = useSQLiteContext();
  const { db: bible } = useBibleDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [verse, setVerse] = useState<{ te: string | null; en: string | null } | null>(null);
  const [state, setState] = useState<"loading" | "saved" | "saving" | "missing" | "error">("loading");
  const latest = useRef({ title, body });
  useEffect(() => { latest.current = { title, body }; });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    db.getFirstAsync<Note>("SELECT title, body, book, chapter, verse, created_at, updated_at FROM notes WHERE id = ? AND deleted = 0", [id])
      .then((n) => { if (!n) return setState("missing"); setNote(n); setTitle(n.title); setBody(n.body); loaded.current = true; setState("saved"); })
      .catch(() => setState("error"));
  }, [db, id]);
  useEffect(() => { if (bible && note?.verse) loadVerse(bible, makeVid(note.book, note.chapter, note.verse)).then(setVerse).catch(() => {}); }, [bible, note]);

  const save = async () => {
    try { await updateNote(db, id, latest.current); setState("saved"); } catch { setState("error"); }
  };
  useEffect(() => {
    if (!loaded.current) return;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 600);
  }, [title, body]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (!loaded.current) return;
    const v = latest.current;
    if (!v.body.trim() && (!v.title.trim() || note === null)) deleteNote(db, id).catch(() => {});
    else save();
  }, []);

  const remove = () => {
    const go = async () => { loaded.current = false; await deleteNote(db, id); router.back(); };
    if (Platform.OS === "web") { if (globalThis.confirm?.("Delete this note?")) go(); return; }
    Alert.alert("Delete note?", "This can't be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: go }]);
  };

  if (state === "missing") return <View style={{ flex: 1, backgroundColor: c.bg, padding: 24 }}><Text style={{ fontFamily: fonts.ui, color: c.textMuted }}>This note no longer exists.</Text></View>;
  const ref = note ? displayRef(note.book, note.chapter, note.verse ?? undefined) : "";
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: note?.verse ? "Verse note" : "Chapter note", headerRight: () => <Pressable onPress={remove} accessibilityRole="button" accessibilityLabel="Delete note" style={{ padding: 8 }}><Icon name="trash" color={c.danger} size={20} /></Pressable> }} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {note ? (
          <Pressable onPress={() => router.push(`/read/${note.book}/${note.chapter}${note.verse ? `?v=${note.verse}` : ""}`)} accessibilityRole="link" accessibilityLabel={`Open ${ref}`}
            style={{ backgroundColor: c.goldSoft, borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <Text style={{ fontFamily: fonts.uiBold, fontSize: 13.5, color: c.gold }}>{ref} ›</Text>
            {verse?.te ? <Text numberOfLines={3} style={{ fontFamily: fonts.teluguScripture, fontSize: 15, lineHeight: 26, color: c.text, marginTop: 6 }}>{verse.te}</Text> : null}
            {verse?.en ? <Text numberOfLines={3} style={{ fontFamily: fonts.englishScripture, fontSize: 16.5, lineHeight: 22, color: c.textMuted, marginTop: 4 }}>{verse.en}</Text> : null}
          </Pressable>
        ) : null}
        <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={c.textMuted} accessibilityLabel="Note title"
          style={[noOutline, { fontFamily: isTe(title) ? fonts.teluguUiBold : fonts.display, fontSize: 27, color: c.text, paddingVertical: 6 }]} />
        <TextInput value={body} onChangeText={setBody} placeholder="Write your reflection… మీ ఆలోచనలు రాయండి" placeholderTextColor={c.textMuted} multiline autoFocus={!!note && !body}
          accessibilityLabel="Note text"
          style={[noOutline, { fontFamily: isTe(body) ? fonts.teluguUi : fonts.ui, fontSize: 17, lineHeight: 27, color: c.text, minHeight: 260, textAlignVertical: "top", marginTop: 6 }]} />
        <Text style={{ fontFamily: fonts.ui, fontSize: 12.5, color: state === "error" ? c.danger : c.textMuted, marginTop: 14 }}>
          {state === "saving" ? "Saving…" : state === "error" ? "Couldn't save. Your text is still here; try again." : note ? `Saved · created ${new Date(note.created_at).toLocaleString()}` : ""}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
