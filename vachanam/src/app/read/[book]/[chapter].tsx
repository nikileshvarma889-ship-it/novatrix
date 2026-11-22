import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View, type ScrollViewInstance } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { BOOK_BY_CODE } from "../../../data/books";
import { neighbour } from "../../../lib/nav";
import { useTheme } from "../../../theme/ThemeProvider";
import { fonts, READER_SIZES } from "../../../theme/typography";
import { Icon } from "../../../components/Icon";
import { EmptyState } from "../../../components/ui";
import { useBibleDb } from "../../../bible/BibleProvider";
import { alignChapter, EN, loadBookNames, loadChapter, TE, type BookNames, type Chapter, type Heading, type VerseRow } from "../../../bible/repo";
import { nowIso, uuid } from "../../../lib/id";
import type { ReadingMode } from "../../../lib/prefs";

const MODES: { key: ReadingMode; label: string }[] = [{ key: "telugu", label: "తెలుగు" }, { key: "parallel", label: "రెండూ · Both" }, { key: "english", label: "English" }];

export default function Reader() {
  const { c, prefs, setPrefs } = useTheme();
  const userDb = useSQLiteContext();
  const { db, error: dbError } = useBibleDb();
  const { width } = useWindowDimensions();
  const p = useLocalSearchParams<{ book: string; chapter: string; v?: string }>();
  const book = BOOK_BY_CODE[p.book ?? ""];
  const chapter = Number(p.chapter);
  const target = p.v ? Number(p.v) : undefined;
  const [data, setData] = useState<Chapter | null>(null);
  const [names, setNames] = useState<BookNames | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const ys = useRef<Record<number, number>>({});
  const valid = !!book && Number.isInteger(chapter) && chapter >= 1 && chapter <= book.chapters;

  useEffect(() => { if (db && !names) loadBookNames(db).then(setNames).catch(() => {}); }, [db]);
  useEffect(() => {
    if (!db || !valid) return;
    let live = true; setData(null); setErr(null); ys.current = {};
    loadChapter(db, book.code, chapter).then((d) => live && setData(d)).catch((e) => live && setErr(String(e?.message ?? e)));
    return () => { live = false; };
  }, [db, book?.code, chapter, valid]);
  // reading history: one entry per chapter visit (a re-open within 30 minutes just refreshes the time)
  useEffect(() => {
    if (!data || !valid) return;
    (async () => {
      const last = await userDb.getFirstAsync<{ id: string; book: string; chapter: number; read_at: string }>("SELECT id, book, chapter, read_at FROM reading_history ORDER BY read_at DESC LIMIT 1");
      if (last && last.book === book.code && last.chapter === chapter && Date.now() - Date.parse(last.read_at) < 30 * 60_000) await userDb.runAsync("UPDATE reading_history SET read_at = ? WHERE id = ?", [nowIso(), last.id]);
      else await userDb.runAsync("INSERT INTO reading_history (id, book, chapter, translation_mode, read_at) VALUES (?, ?, ?, ?, ?)", [uuid(), book.code, chapter, prefs.readingMode, nowIso()]);
    })().catch(() => {});
  }, [data]);

  if (!valid) return <View style={{ flex: 1, backgroundColor: c.bg }}><EmptyState icon="info" title="Chapter not found" body="That book or chapter doesn't exist." action={{ label: "Back to books", onPress: () => router.replace("/bible") }} /></View>;

  const mode = prefs.readingMode;
  const side = mode === "parallel" && (prefs.parallelLayout === "side" || width >= 760);
  const size = prefs.readerSize, lh = prefs.lineSpacing;
  const teName = names?.[TE]?.[book.code]?.short_name, teLong = names?.[TE]?.[book.code]?.name;
  const prev = neighbour(book.code, chapter, -1), next = neighbour(book.code, chapter, 1);
  const go = (t: { book: string; chapter: number } | null) => t && router.replace(`/read/${t.book}/${t.chapter}`);
  const sizeIdx = READER_SIZES.indexOf(size as (typeof READER_SIZES)[number]);
  const setSize = (d: number) => setPrefs({ readerSize: READER_SIZES[Math.max(0, Math.min(READER_SIZES.length - 1, (sizeIdx < 0 ? 2 : sizeIdx) + d))] });
  const onRowLayout = (verse: number, y: number) => {
    ys.current[verse] = y;
    if (target === verse) setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - 80), animated: true }), 50);
  };

  const teStyle = { fontFamily: fonts.teluguScripture, fontSize: size, lineHeight: size * lh * 1.08, color: c.text };
  const enStyle = (muted: boolean) => ({ fontFamily: fonts.englishScripture, fontSize: size + 2, lineHeight: (size + 2) * lh, color: muted ? c.textMuted : c.text });
  const Num = ({ label }: { label: string }) => <Text style={{ fontFamily: fonts.uiBold, fontSize: size * 0.62, color: c.gold }}>{label}{"  "}</Text>;
  const HeadingView = ({ h, te }: { h: Heading; te: boolean }) => (
    <Text accessibilityRole="header" style={{ fontFamily: te ? fonts.teluguScriptureBold : fonts.display, fontSize: h.level === 9 ? size * 0.85 : te ? size * 0.95 : size * 1.15, fontStyle: h.level === 9 ? "italic" : "normal", color: h.level === 9 ? c.textMuted : c.primary, marginTop: 18, marginBottom: 6, lineHeight: size * 1.6 }}>{h.text}</Text>
  );
  const headsBefore = (list: Heading[], verse: number, prevVerse: number) => list.filter((h) => h.before_verse > prevVerse && h.before_verse <= verse);
  const hi = (verse: number, vto?: number | null) => target !== undefined && target >= verse && target <= (vto ?? verse);

  // single-language flowing text with paragraphs
  const single = (rows: VerseRow[], heads: Heading[], te: boolean) => {
    let prevVerse = 0;
    return rows.map((v) => {
      const hs = headsBefore(heads, v.verse, prevVerse); prevVerse = v.vto ?? v.verse;
      return (
        <View key={v.vid} onLayout={(e) => onRowLayout(v.verse, e.nativeEvent.layout.y)}>
          {hs.map((h, i) => <HeadingView key={i} h={h} te={te} />)}
          <Text accessible accessibilityLabel={`Verse ${v.verse}. ${v.text}`}
            style={[te ? teStyle : enStyle(false), { marginTop: v.para ? size * 0.6 : 2, paddingLeft: v.poetry ? 14 : 0, backgroundColor: hi(v.verse, v.vto) ? c.goldSoft : "transparent", borderRadius: 6 }]}>
            <Num label={v.vto ? `${v.verse}-${v.vto}` : String(v.verse)} />{v.text}
          </Text>
        </View>
      );
    });
  };
  const parallel = (d: Chapter) => {
    let prevVerse = 0;
    return alignChapter(d.te, d.en).map((r) => {
      const last = r.te?.vto ?? r.en.at(-1)?.verse ?? r.key;
      const hTe = headsBefore(d.headTe, r.key, prevVerse), hEn = headsBefore(d.headEn, r.key, prevVerse); prevVerse = last;
      const teBlock = r.te ? <Text style={teStyle}><Num label={r.label} />{r.te.text}</Text> : <Text style={[teStyle, { color: c.textMuted }]}>—</Text>;
      const enBlock = <Text style={enStyle(!side)}>{r.en.map((e, i) => <Text key={e.vid}>{r.en.length > 1 || !r.te || side ? <Num label={String(e.verse)} /> : null}{e.text}{i < r.en.length - 1 ? " " : ""}</Text>)}</Text>;
      return (
        <View key={r.key} onLayout={(e) => onRowLayout(r.key, e.nativeEvent.layout.y)} accessible accessibilityLabel={`Verse ${r.label}. ${r.te?.text ?? ""} ${r.en.map((e) => e.text).join(" ")}`}>
          {side ? (
            <View style={{ flexDirection: "row", gap: 18 }}>
              <View style={{ flex: 1 }}>{hTe.map((h, i) => <HeadingView key={i} h={h} te />)}</View>
              <View style={{ flex: 1 }}>{hEn.map((h, i) => <HeadingView key={i} h={h} te={false} />)}</View>
            </View>
          ) : <>{hTe.map((h, i) => <HeadingView key={"t" + i} h={h} te />)}{hEn.slice(0, 1).map((h, i) => <Text key={"e" + i} style={{ fontFamily: fonts.displayItalic, fontSize: size * 0.9, color: c.textMuted, marginTop: -2, marginBottom: 6 }}>{h.text}</Text>)}</>}
          <View style={[side ? { flexDirection: "row", gap: 18 } : null, { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, backgroundColor: hi(r.key, last) ? c.goldSoft : "transparent", borderBottomWidth: side ? 0 : 0.5, borderBottomColor: c.border }]}>
            <View style={side ? { flex: 1 } : null}>{teBlock}</View>
            <View style={side ? { flex: 1 } : { marginTop: 4 }}>{enBlock}</View>
          </View>
        </View>
      );
    });
  };

  const NavBtn = ({ to, dir }: { to: typeof prev; dir: 1 | -1 }) => (
    <Pressable disabled={!to} onPress={() => go(to)} accessibilityRole="button" accessibilityLabel={dir === 1 ? "Next chapter" : "Previous chapter"}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surface, borderWidth: 0.5, borderColor: c.border, opacity: !to ? 0.35 : pressed ? 0.7 : 1 })}>
      {dir === -1 ? <Icon name="back" color={c.primary} size={16} /> : null}
      <Text style={{ fontFamily: fonts.uiMedium, fontSize: 13.5, color: c.text }}>{to ? `${BOOK_BY_CODE[to.book].name} ${to.chapter}` : "—"}</Text>
      {dir === 1 ? <Icon name="chevron" color={c.primary} size={16} /> : null}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{
        title: mode === "telugu" && teName ? `${teName} ${chapter}` : `${book.name} ${chapter}`,
        headerRight: () => (
          <View style={{ flexDirection: "row", gap: 2 }}>
            <Pressable onPress={() => setSize(-1)} accessibilityRole="button" accessibilityLabel="Smaller text" style={{ padding: 8 }}><Text style={{ fontFamily: fonts.uiBold, fontSize: 14, color: c.primary }}>A−</Text></Pressable>
            <Pressable onPress={() => setSize(1)} accessibilityRole="button" accessibilityLabel="Larger text" style={{ padding: 8 }}><Text style={{ fontFamily: fonts.uiBold, fontSize: 18, color: c.primary }}>A+</Text></Pressable>
          </View>
        ),
      }} />
      {/* language mode */}
      <View style={{ flexDirection: "row", marginHorizontal: 16, marginBottom: 4, backgroundColor: c.surfaceAlt, borderRadius: 12, padding: 3 }} accessibilityRole="tablist">
        {MODES.map((m) => {
          const on = m.key === mode;
          return (
            <Pressable key={m.key} onPress={() => setPrefs({ readingMode: m.key })} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`Reading mode ${m.key}`}
              style={{ flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center", backgroundColor: on ? c.surface : "transparent" }}>
              <Text style={{ fontFamily: /[ఀ-౿]/.test(m.label) ? fonts.teluguUiBold : fonts.uiBold, fontSize: 13, color: on ? c.primary : c.textMuted }}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {mode === "parallel" && width < 760 ? (
        <Pressable onPress={() => setPrefs({ parallelLayout: prefs.parallelLayout === "side" ? "stacked" : "side" })} accessibilityRole="button" accessibilityLabel={prefs.parallelLayout === "side" ? "Show stacked" : "Show side by side"}
          style={{ alignSelf: "flex-end", marginRight: 18, paddingVertical: 4 }}>
          <Text style={{ fontFamily: fonts.uiMedium, fontSize: 12.5, color: c.primary }}>{prefs.parallelLayout === "side" ? "Stacked view" : "Side-by-side view"}</Text>
        </Pressable>
      ) : null}

      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text style={{ fontFamily: fonts.teluguScriptureBold, fontSize: 26, color: c.text, textAlign: "center", marginTop: 10, lineHeight: 42, display: mode === "english" ? "none" : "flex" }}>{teLong ?? ""}</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: mode === "english" ? 40 : 24, color: mode === "english" ? c.text : c.textMuted, textAlign: "center", display: mode === "telugu" ? "none" : "flex" }}>{book.name}</Text>
        <Text style={{ fontFamily: fonts.uiMedium, fontSize: 13, letterSpacing: 2, color: c.gold, textAlign: "center", marginBottom: 10, marginTop: 4 }}>{mode === "telugu" ? `${chapter}వ అధ్యాయము` : `CHAPTER ${chapter}`}</Text>
        {dbError || err ? <EmptyState icon="info" title="Couldn't open the Bible" body={dbError ?? err ?? ""} /> : null}
        {!data && !dbError && !err ? <ActivityIndicator color={c.gold} style={{ marginTop: 40 }} accessibilityLabel="Loading chapter" /> : null}
        {data ? (mode === "telugu" ? single(data.te, data.headTe, true) : mode === "english" ? single(data.en, data.headEn, false) : parallel(data)) : null}
        {data ? (
          <Text style={{ fontFamily: fonts.ui, fontSize: 11.5, color: c.textMuted, textAlign: "center", marginTop: 28, lineHeight: 17 }}>
            {mode !== "english" ? "IRV Telugu © 2017, 2019 Bridge Connectivity Solutions · CC BY-SA 4.0" : ""}{mode === "parallel" ? "\n" : ""}{mode !== "telugu" ? "Berean Standard Bible · Public domain" : ""}
          </Text>
        ) : null}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 14, borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.bg }}>
        <NavBtn to={prev} dir={-1} />
        <NavBtn to={next} dir={1} />
      </View>
    </View>
  );
}
