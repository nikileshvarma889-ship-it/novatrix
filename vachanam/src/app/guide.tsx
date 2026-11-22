import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { router, Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { Icon } from "../components/Icon";
import { Card, noOutline } from "../components/ui";
import { askGuide, guideConfigured, GuideError, type ChatTurn, type GuideLang } from "../lib/guideClient";
import { splitRefs } from "../lib/refparse";
import { nowIso, uuid } from "../lib/id";

type Msg = { id: string; role: "user" | "assistant"; content: string };
const SUGGESTIONS = [
  "What does John 3:16 mean?",
  "Verses for when I feel afraid",
  "ప్రార్థన గురించి బైబిలు ఏమి చెబుతుంది?",
  "Who was Ruth, and why does her story matter?",
  "Help me pray for my family",
];
const LANGS: { key: GuideLang; label: string }[] = [{ key: "en", label: "English" }, { key: "te", label: "తెలుగు" }, { key: "both", label: "Both" }];
const isTe = (s: string) => /[ఀ-౿]/.test(s);

/** Light formatting for answers: **bold**, "# headings", "- bullets", and tappable Bible citations. */
function Rich({ text, color }: { text: string; color: string }) {
  const { c } = useTheme();
  return (
    <>
      {text.split("\n").map((rawLine, li) => {
        let line = rawLine, heading = false;
        if (/^#{1,4}\s/.test(line)) { line = line.replace(/^#{1,4}\s/, ""); heading = true; }
        const bullet = /^\s*[-*]\s+/.test(line);
        if (bullet) line = "•  " + line.replace(/^\s*[-*]\s+/, "");
        const te = isTe(line);
        const base = { fontFamily: heading ? (te ? fonts.teluguUiBold : fonts.uiBold) : te ? fonts.teluguUi : fonts.ui, fontSize: heading ? 16.5 : 15.5, lineHeight: te ? 26 : 23, color };
        return (
          <Text key={li} style={[base, { marginTop: heading && li ? 8 : 0, paddingLeft: bullet ? 4 : 0, minHeight: line ? undefined : 10 }]}>
            {line.split(/(\*\*[^*]+\*\*)/g).map((part, pi) => {
              const bold = /^\*\*[^*]+\*\*$/.test(part);
              const inner = bold ? part.slice(2, -2) : part;
              return splitRefs(inner).map((seg, si) =>
                seg.kind === "ref"
                  ? <Text key={`${pi}-${si}`} accessibilityRole="link" onPress={() => router.push(`/read/${seg.book}/${seg.chapter}`)}
                      style={{ color: c.gold, fontFamily: fonts.uiBold, textDecorationLine: "underline" }}>{seg.text}</Text>
                  : <Text key={`${pi}-${si}`} style={bold ? { fontFamily: te ? fonts.teluguUiBold : fonts.uiBold } : undefined}>{seg.text}</Text>);
            })}
          </Text>
        );
      })}
    </>
  );
}

export default function Guide() {
  const { c, prefs, setPrefs } = useTheme();
  const db = useSQLiteContext();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    db.getAllAsync<Msg>("SELECT id, role, content FROM guide_messages ORDER BY created_at, rowid").then(setMsgs).catch(() => setMsgs([]));
    return () => abort.current?.abort();
  }, [db]);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy || !msgs) return;
    setError(null); setInput("");
    const user: Msg = { id: uuid(), role: "user", content: q };
    const reply: Msg = { id: uuid(), role: "assistant", content: "" };
    const history: ChatTurn[] = [...msgs, user].map(({ role, content }) => ({ role, content }));
    setMsgs([...msgs, user, reply]);
    await db.runAsync("INSERT INTO guide_messages (id, role, content, created_at) VALUES (?, 'user', ?, ?)", [user.id, q, nowIso()]);
    setBusy(true);
    const ctl = new AbortController(); abort.current = ctl;
    let acc = "";
    try {
      await askGuide(history, prefs.guideLang, (d) => { acc += d; setMsgs((m) => m && m.map((x) => (x.id === reply.id ? { ...x, content: acc } : x))); }, ctl.signal);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e instanceof GuideError ? { code: e.code, message: e.message } : { code: "server", message: "Something went wrong. Please try again." });
    } finally {
      setBusy(false); abort.current = null;
      if (acc.trim()) await db.runAsync("INSERT INTO guide_messages (id, role, content, created_at) VALUES (?, 'assistant', ?, ?)", [reply.id, acc, nowIso()]).catch(() => {});
      else setMsgs((m) => m && m.filter((x) => x.id !== reply.id));
    }
  }, [busy, msgs, db, prefs.guideLang]);

  const retry = () => {
    if (!msgs) return;
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const idx = msgs.lastIndexOf(lastUser);
    db.runAsync("DELETE FROM guide_messages WHERE id = ?", [lastUser.id]).then(() => { setMsgs(msgs.slice(0, idx)); setTimeout(() => send(lastUser.content), 0); });
  };
  const clear = async () => { abort.current?.abort(); await db.runAsync("DELETE FROM guide_messages"); setMsgs([]); setError(null); };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ headerRight: () => (msgs?.length ? <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel="New conversation" style={{ padding: 8 }}><Text style={{ fontFamily: fonts.uiMedium, color: c.primary }}>New chat</Text></Pressable> : null) }} />
      {/* language */}
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.ui, fontSize: 12.5, color: c.textMuted }}>Answer in</Text>
        {LANGS.map((l) => {
          const on = prefs.guideLang === l.key;
          return (
            <Pressable key={l.key} onPress={() => setPrefs({ guideLang: l.key })} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Answer in ${l.label}`}
              style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }}>
              <Text style={{ fontFamily: isTe(l.label) ? fonts.teluguUiBold : fonts.uiMedium, fontSize: 12.5, color: on ? c.primaryText : c.text }}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {!guideConfigured ? (
          <Card style={{ backgroundColor: c.goldSoft, borderColor: c.goldSoft, marginBottom: 14 }}>
            <Text style={{ fontFamily: fonts.uiBold, fontSize: 15, color: c.text }}>Not connected yet</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 14, lineHeight: 21, color: c.text, marginTop: 4 }}>The Bible Guide runs on Claude through a secure server function. Deploy the function and set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (see README) to turn it on.</Text>
          </Card>
        ) : null}
        {msgs && msgs.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.goldSoft, alignItems: "center", justifyContent: "center" }}><Icon name="spark" color={c.gold} size={28} /></View>
            <Text style={{ fontFamily: fonts.display, fontSize: 28, color: c.text, marginTop: 10 }}>Ask about the Bible</Text>
            <Text style={{ fontFamily: fonts.teluguUi, fontSize: 14, color: c.gold }}>బైబిలు గురించి అడగండి</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 14, lineHeight: 21, color: c.textMuted, textAlign: "center", marginTop: 8, maxWidth: 340 }}>
              Explanations of verses, Bible characters and history, faith questions and prayers, in Telugu or English. The guide only talks about the Bible and the Christian faith.
            </Text>
            <View style={{ width: "100%", marginTop: 18, gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => send(s)} disabled={!guideConfigured} accessibilityRole="button" accessibilityLabel={s}
                  style={({ pressed }) => ({ padding: 13, borderRadius: 14, backgroundColor: c.surface, borderWidth: 0.5, borderColor: c.border, opacity: !guideConfigured ? 0.5 : pressed ? 0.7 : 1 })}>
                  <Text style={{ fontFamily: isTe(s) ? fonts.teluguUi : fonts.uiMedium, fontSize: 14.5, color: c.text }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {msgs?.map((m) => m.role === "user" ? (
          <View key={m.id} style={{ alignSelf: "flex-end", maxWidth: "85%", backgroundColor: c.primary, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 }}>
            <Text style={{ fontFamily: isTe(m.content) ? fonts.teluguUi : fonts.ui, fontSize: 15.5, lineHeight: isTe(m.content) ? 26 : 22, color: c.primaryText }}>{m.content}</Text>
          </View>
        ) : (
          <View key={m.id} style={{ alignSelf: "flex-start", maxWidth: "94%", marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Icon name="spark" color={c.gold} size={14} />
              <Text style={{ fontFamily: fonts.uiBold, fontSize: 12, color: c.gold, letterSpacing: 0.6 }}>BIBLE GUIDE</Text>
            </View>
            <View style={{ backgroundColor: c.surface, borderRadius: 18, borderTopLeftRadius: 6, padding: 14, borderWidth: 0.5, borderColor: c.border }}>
              {m.content ? <Rich text={m.content} color={c.text} /> : <ActivityIndicator color={c.gold} accessibilityLabel="Bible Guide is answering" />}
            </View>
          </View>
        ))}
        {error ? (
          <Card style={{ borderColor: c.danger, marginBottom: 12 }}>
            <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: c.danger }}>{error.message}</Text>
            {error.code !== "refusal" && error.code !== "not_configured" ? <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel="Try again" style={{ marginTop: 8 }}><Text style={{ fontFamily: fonts.uiBold, color: c.primary }}>Try again</Text></Pressable> : null}
          </Card>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.bg }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <TextInput value={input} onChangeText={setInput} placeholder="Ask about a verse, a person, or your faith…" placeholderTextColor={c.textMuted} multiline maxLength={4000}
            accessibilityLabel="Your question" editable={guideConfigured} onSubmitEditing={() => send(input)}
            style={[noOutline, { flex: 1, maxHeight: 120, minHeight: 46, backgroundColor: c.surface, borderRadius: 16, borderWidth: 0.5, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: isTe(input) ? fonts.teluguUi : fonts.ui, fontSize: 15.5, color: c.text }]} />
          <Pressable onPress={() => (busy ? abort.current?.abort() : send(input))} disabled={!guideConfigured || (!busy && !input.trim())}
            accessibilityRole="button" accessibilityLabel={busy ? "Stop answer" : "Send question"}
            style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", opacity: !guideConfigured || (!busy && !input.trim()) ? 0.4 : pressed ? 0.75 : 1 })}>
            <Icon name={busy ? "stop" : "send"} color={c.primaryText} size={20} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: c.textMuted, textAlign: "center", marginTop: 6 }}>Powered by Claude · AI can make mistakes. Check answers against Scripture.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}
