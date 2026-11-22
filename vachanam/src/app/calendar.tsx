import React, { useCallback, useMemo, useState } from "react";
import { Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Button, Card, noOutline, Screen, SectionHeader } from "../components/ui";
import { Icon } from "../components/Icon";
import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { clampMonth, dayKey, feastIndex, keyOf, MAX_YEAR, MIN_YEAR, monthGrid, MONTHS_EN, MONTHS_TE, parseKey, WEEKDAYS_EN, WEEKDAYS_TE } from "../lib/calendar";
import { nowIso, uuid } from "../lib/id";

type Ev = { id: string; day: string; title: string; note: string };
const FEASTS = feastIndex();

export default function CalendarScreen() {
  const { c } = useTheme();
  const db = useSQLiteContext();
  const today = new Date();
  const [[year, month], setYM] = useState<[number, number]>(clampMonth(today.getFullYear(), today.getMonth()));
  const [selected, setSelected] = useState<string>(keyOf(today));
  const [events, setEvents] = useState<Ev[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState(""); const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    db.getAllAsync<Ev>("SELECT id, day, title, note FROM events WHERE deleted = 0 ORDER BY day, created_at").then(setEvents).catch((e) => setErr(String(e?.message ?? e)));
  }, [db]);
  useFocusEffect(load);
  const byDay = useMemo(() => { const m: Record<string, Ev[]> = {}; for (const e of events) (m[e.day] ??= []).push(e); return m; }, [events]);

  const cells = monthGrid(year, month);
  const canPrev = !(year === MIN_YEAR && month === 0), canNext = !(year === MAX_YEAR && month === 11);
  const shift = (d: number) => { const t = new Date(year, month + d, 1); setYM(clampMonth(t.getFullYear(), t.getMonth())); };
  const todayKey = keyOf(today);
  const monthFeasts = Object.entries(FEASTS).filter(([k]) => k.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).sort(([a], [b]) => a.localeCompare(b));
  const selDate = parseKey(selected);
  const selFeasts = FEASTS[selected] ?? [];
  const selEvents = byDay[selected] ?? [];

  const save = async () => {
    if (!title.trim()) return;
    const t = nowIso();
    try {
      await db.runAsync("INSERT INTO events (id, day, title, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [uuid(), selected, title.trim(), note.trim(), t, t]);
      setTitle(""); setNote(""); setAdding(false); load();
    } catch (e: any) { setErr(String(e?.message ?? e)); }
  };
  const remove = (ev: Ev) => {
    const go = async () => { await db.runAsync("UPDATE events SET deleted = 1, updated_at = ? WHERE id = ?", [nowIso(), ev.id]); load(); };
    if (Platform.OS === "web") { if (globalThis.confirm?.(`Delete "${ev.title}"?`)) go(); return; }
    Alert.alert("Delete event?", ev.title, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: go }]);
  };
  const isTe = (s: string) => /[ఀ-౿]/.test(s);

  const Arrow = ({ dir, enabled }: { dir: 1 | -1; enabled: boolean }) => (
    <Pressable disabled={!enabled} onPress={() => shift(dir)} accessibilityRole="button" accessibilityLabel={dir === 1 ? "Next month" : "Previous month"}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderWidth: 0.5, borderColor: c.border, opacity: !enabled ? 0.3 : pressed ? 0.6 : 1 })}>
      <Icon name={dir === 1 ? "chevron" : "back"} color={c.primary} size={18} />
    </Pressable>
  );

  return (
    <Screen padTop={false}>
      {/* year chips */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i).map((y) => {
          const on = y === year;
          return (
            <Pressable key={y} onPress={() => setYM([y, month])} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Year ${y}`}
              style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }}>
              <Text style={{ fontFamily: fonts.uiMedium, fontSize: 13.5, color: on ? c.primaryText : c.text }}>{y}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* month header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Arrow dir={-1} enabled={canPrev} />
        <View style={{ alignItems: "center" }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 28, color: c.text }}>{MONTHS_EN[month]} {year}</Text>
          <Text style={{ fontFamily: fonts.teluguUi, fontSize: 13.5, color: c.gold }}>{MONTHS_TE[month]} {year}</Text>
        </View>
        <Arrow dir={1} enabled={canNext} />
      </View>

      {/* grid */}
      <Card style={{ padding: 10 }}>
        <View style={{ flexDirection: "row" }}>
          {WEEKDAYS_EN.map((w, i) => (
            <View key={w} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
              <Text style={{ fontFamily: fonts.uiBold, fontSize: 11.5, color: i === 0 ? c.danger : c.textMuted }}>{w}</Text>
              <Text style={{ fontFamily: fonts.teluguUi, fontSize: 10, color: c.textMuted }}>{WEEKDAYS_TE[i]}</Text>
            </View>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
              if (!d) return <View key={i} style={{ flex: 1, aspectRatio: 1 }} />;
              const k = dayKey(year, month, d);
              const f = FEASTS[k], ev = byDay[k];
              const sel = k === selected, isToday = k === todayKey;
              const major = f?.some((x) => x.major);
              return (
                <Pressable key={i} onPress={() => { setSelected(k); setAdding(false); }} accessibilityRole="button"
                  accessibilityLabel={`${d} ${MONTHS_EN[month]}${f ? ", " + f.map((x) => x.en).join(", ") : ""}${ev ? `, ${ev.length} event${ev.length > 1 ? "s" : ""}` : ""}`} accessibilityState={{ selected: sel }}
                  style={{ flex: 1, aspectRatio: 1, padding: 2 }}>
                  <View style={{ flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: sel ? c.primary : major ? c.goldSoft : "transparent", borderWidth: isToday && !sel ? 1.5 : 0, borderColor: c.gold }}>
                    <Text style={{ fontFamily: sel || major ? fonts.uiBold : fonts.ui, fontSize: 15, color: sel ? c.primaryText : i === 0 ? c.danger : c.text }}>{d}</Text>
                    <View style={{ flexDirection: "row", gap: 3, height: 5, marginTop: 2 }}>
                      {f ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: sel ? c.goldSoft : c.gold }} /> : null}
                      {ev ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: sel ? c.primaryText : c.primary }} /> : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.gold }} /><Text style={{ fontFamily: fonts.ui, fontSize: 12, color: c.textMuted }}>Church festival</Text></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.primary }} /><Text style={{ fontFamily: fonts.ui, fontSize: 12, color: c.textMuted }}>My event</Text></View>
        </View>
      </Card>

      {/* selected day */}
      <SectionHeader title={`${selDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`} />
      {err ? <Text style={{ color: c.danger, marginBottom: 8 }}>{err}</Text> : null}
      {selFeasts.map((f) => (
        <Card key={f.en} style={{ marginBottom: 10, backgroundColor: c.goldSoft, borderColor: c.goldSoft }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: c.text }}>{f.en}</Text>
          {f.te ? <Text style={{ fontFamily: fonts.teluguUiBold, fontSize: 15, color: c.gold, marginTop: 2 }}>{f.te}</Text> : null}
        </Card>
      ))}
      {selEvents.map((ev) => (
        <Card key={ev.id} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: isTe(ev.title) ? fonts.teluguUiBold : fonts.uiBold, fontSize: 16, color: c.text }}>{ev.title}</Text>
              {ev.note ? <Text style={{ fontFamily: isTe(ev.note) ? fonts.teluguUi : fonts.ui, fontSize: 14, color: c.textMuted, marginTop: 3 }}>{ev.note}</Text> : null}
            </View>
            <Pressable onPress={() => remove(ev)} accessibilityRole="button" accessibilityLabel={`Delete ${ev.title}`} style={{ padding: 4 }}><Icon name="trash" color={c.danger} size={18} /></Pressable>
          </View>
        </Card>
      ))}
      {!selFeasts.length && !selEvents.length && !adding ? <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: c.textMuted, marginBottom: 12 }}>No festivals or events on this day.</Text> : null}
      {adding ? (
        <Card>
          <TextInput value={title} onChangeText={setTitle} placeholder="Event title (e.g. Prayer meeting)" placeholderTextColor={c.textMuted} accessibilityLabel="Event title" autoFocus
            style={[noOutline, { fontFamily: isTe(title) ? fonts.teluguUi : fonts.uiMedium, fontSize: 16, color: c.text, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: c.border }]} />
          <TextInput value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={c.textMuted} accessibilityLabel="Event note" multiline
            style={[noOutline, { fontFamily: isTe(note) ? fonts.teluguUi : fonts.ui, fontSize: 15, color: c.text, paddingVertical: 8, minHeight: 60, textAlignVertical: "top" }]} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <Button label="Save event" onPress={save} disabled={!title.trim()} style={{ flex: 1 }} />
            <Button label="Cancel" variant="ghost" onPress={() => { setAdding(false); setTitle(""); setNote(""); }} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <Button label="Add event on this day" onPress={() => setAdding(true)} variant="ghost" />
      )}

      {/* this month's festivals */}
      {monthFeasts.length ? <SectionHeader title={`Festivals in ${MONTHS_EN[month]}`} /> : null}
      {monthFeasts.map(([k, fs]) => fs.map((f) => (
        <Pressable key={k + f.en} onPress={() => setSelected(k)} accessibilityRole="button" accessibilityLabel={`${f.en}, ${parseKey(k).getDate()} ${MONTHS_EN[month]}`}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
          <View style={{ width: 44, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: f.major ? c.gold : c.text }}>{parseKey(k).getDate()}</Text>
            <Text style={{ fontFamily: fonts.ui, fontSize: 11, color: c.textMuted }}>{WEEKDAYS_EN[parseKey(k).getDay()]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: f.major ? fonts.uiBold : fonts.uiMedium, fontSize: 15.5, color: c.text }}>{f.en}</Text>
            {f.te ? <Text style={{ fontFamily: fonts.teluguUi, fontSize: 13.5, color: c.textMuted }}>{f.te}</Text> : null}
          </View>
        </Pressable>
      )))}
      <Text style={{ fontFamily: fonts.ui, fontSize: 12, color: c.textMuted, marginTop: 18, lineHeight: 18 }}>
        Covers {MIN_YEAR}–{MAX_YEAR}. Festival dates follow the Western (Gregorian) church calendar used by most Telugu churches; Orthodox Easter dates differ.
      </Text>
    </Screen>
  );
}
