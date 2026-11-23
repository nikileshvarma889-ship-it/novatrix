import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, Text, useWindowDimensions, View, type ScrollViewInstance } from "react-native";
import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { BOOK_BY_CODE } from "../../../data/books";
import { neighbour } from "../../../lib/nav";
import { useTheme } from "../../../theme/ThemeProvider";
import { fonts, READER_SIZES } from "../../../theme/typography";
import { Icon } from "../../../components/Icon";
import { EmptyState } from "../../../components/ui";
import { useBibleDb } from "../../../bible/BibleProvider";
import { alignChapter, loadBookNames, loadChapter, loadPair, TE, type Translation, type BookNames, type Chapter, type Heading, type VerseRow } from "../../../bible/repo";
import { nowIso, uuid } from "../../../lib/id";
import type { ReadingMode } from "../../../lib/prefs";
import { HIGHLIGHTS, type HighlightColor } from "../../../theme/colors";
import { ActionBar, type Action } from "../../../components/reader/ActionBar";
import { CollectionPicker } from "../../../components/reader/CollectionPicker";
import * as M from "../../../lib/marks";

const MODES: { key: ReadingMode; label: string }[] = [{ key: "telugu", label: "తెలుగు" }, { key: "parallel", label: "రెండూ · Both" }, { key: "english", label: "English" }];

/** Keyed by chapter so all per-chapter state starts fresh when navigating to another chapter. */
export default function ReaderRoute() {
  const p = useLocalSearchParams<{ book: string; chapter: string; v?: string }>();
  return <Reader key={`${p.book}.${p.chapter}`} />;
}

function NavBtn({ to, dir, onGo }: { to: { book: string; chapter: number } | null; dir: 1 | -1; onGo: (t: { book: string; chapter: number } | null) => void }) {
  const { c } = useTheme();
  return (
    <Pressable disabled={!to} onPress={() => onGo(to)} accessibilityRole="button" accessibilityLabel={dir === 1 ? "Next chapter" : "Previous chapter"}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surface, borderWidth: 0.5, borderColor: c.border, opacity: !to ? 0.35 : pressed ? 0.7 : 1 })}>
      {dir === -1 ? <Icon name="back" color={c.primary} size={16} /> : null}
      <Text style={{ fontFamily: fonts.uiMedium, fontSize: 13.5, color: c.text }}>{to ? `${BOOK_BY_CODE[to.book].name} ${to.chapter}` : "—"}</Text>
      {dir === 1 ? <Icon name="chevron" color={c.primary} size={16} /> : null}
    </Pressable>
  );
}

function Reader() {
  const { c, isDark, prefs, setPrefs } = useTheme();
  const userDb = useSQLiteContext();
  const { db, error: dbError } = useBibleDb();
  const { width } = useWindowDimensions();
  const p = useLocalSearchParams<{ book: string; chapter: string; v?: string }>();
  const book = BOOK_BY_CODE[p.book ?? ""];
  const chapter = Number(p.chapter);
  const target = p.v ? Number(p.v) : undefined;
  const [data, setData] = useState<Chapter | null>(null);
  const [names, setNames] = useState<BookNames | null>(null);
  const [pair, setPair] = useState<{ te?: Translation; en?: Translation }>({});
  const [err, setErr] = useState<string | null>(null);
  const [marks, setMarks] = useState<M.ChapterMarks | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [picker, setPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const [targetY, setTargetY] = useState<number | null>(null);
  const valid = !!book && Number.isInteger(chapter) && chapter >= 1 && chapter <= book.chapters;

  useEffect(() => { if (db && !names) { loadBookNames(db).then(setNames).catch(() => {}); loadPair(db).then(setPair).catch(() => {}); } }, [db]);
  useEffect(() => {
    if (!db || !valid) return;
    let live = true;
    loadChapter(db, book.code, chapter).then((d) => live && setData(d)).catch((e) => live && setErr(String(e?.message ?? e)));
    return () => { live = false; };
  }, [db, book?.code, chapter, valid]);
  const reloadMarks = () => valid && M.loadChapterMarks(userDb, book.code, chapter).then(setMarks).catch(() => {});
  useEffect(() => { reloadMarks(); }, [book?.code, chapter]);
  // jump to ?v=<verse> once its row has been laid out
  useEffect(() => {
    if (targetY === null) return;
    const t = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, targetY - 80), animated: true }), 50);
    return () => clearTimeout(t);
  }, [targetY]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1800); return () => clearTimeout(t); }, [toast]);
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
    if (target === verse && targetY === null) setTargetY(y);
  };

  const teStyle = { fontFamily: fonts.teluguScripture, fontSize: size, lineHeight: size * lh * 1.08, color: c.text };
  const enStyle = (muted: boolean) => ({ fontFamily: fonts.englishScripture, fontSize: size + 2, lineHeight: (size + 2) * lh, color: muted ? c.textMuted : c.text });
  const Num = ({ label }: { label: string }) => <Text style={{ fontFamily: fonts.uiBold, fontSize: size * 0.62, color: c.gold }}>{label}{"  "}</Text>;
  const HeadingView = ({ h, te }: { h: Heading; te: boolean }) => (
    <Text accessibilityRole="header" style={{ fontFamily: te ? fonts.teluguScriptureBold : fonts.display, fontSize: h.level === 9 ? size * 0.85 : te ? size * 0.95 : size * 1.15, fontStyle: h.level === 9 ? "italic" : "normal", color: h.level === 9 ? c.textMuted : c.primary, marginTop: 18, marginBottom: 6, lineHeight: size * 1.6 }}>{h.text}</Text>
  );
  const headsBefore = (list: Heading[], verse: number, prevVerse: number) => list.filter((h) => h.before_verse > prevVerse && h.before_verse <= verse);
  const hi = (verse: number, vto?: number | null) => target !== undefined && target >= verse && target <= (vto ?? verse);
  const hlBg = (verse: number) => { const col = marks?.highlights[verse]; return col ? HIGHLIGHTS[col][isDark ? "dark" : "light"] : undefined; };
  const isSel = (verse: number) => sel.has(verse);
  const toggle = (verse: number) => setSel((s0) => { const n = new Set(s0); if (n.has(verse)) n.delete(verse); else n.add(verse); return n; });
  const ulStyle = (on?: boolean) => (on ? { textDecorationLine: "underline" as const, textDecorationColor: c.gold } : null);
  const markers = (verse: number) => (
    <>
      {marks?.bookmarked.has(verse) ? <Text style={{ color: c.gold, fontSize: size * 0.6 }}> 🔖</Text> : null}
      {marks?.notes[verse] ? <Text accessibilityRole="link" accessibilityLabel={`Open note on verse ${verse}`} onPress={() => router.push(`/note/${marks.notes[verse][0]}`)} style={{ color: c.gold, fontSize: size * 0.7 }}> ✎</Text> : null}
    </>
  );

  // single-language flowing text with paragraphs
  const single = (rows: VerseRow[], heads: Heading[], te: boolean) => {
    let prevVerse = 0;
    return rows.map((v) => {
      const hs = headsBefore(heads, v.verse, prevVerse); prevVerse = v.vto ?? v.verse;
      return (
        <View key={v.vid} onLayout={(e) => onRowLayout(v.verse, e.nativeEvent.layout.y)}>
          {hs.map((h, i) => <HeadingView key={i} h={h} te={te} />)}
          <Pressable onPress={() => toggle(v.verse)} accessibilityRole="button" accessibilityState={{ selected: isSel(v.verse) }} accessibilityLabel={`Verse ${v.verse}. ${v.text}`}
            style={{ marginTop: v.para ? size * 0.6 : 2, borderRadius: 8, borderWidth: 1.5, borderStyle: "dashed", borderColor: isSel(v.verse) ? c.gold : "transparent", backgroundColor: hlBg(v.verse) ?? (hi(v.verse, v.vto) && !marks?.highlights[v.verse] ? c.goldSoft : "transparent"), paddingHorizontal: 4 }}>
            <Text style={[te ? teStyle : enStyle(false), { paddingLeft: v.poetry ? 14 : 0 }]}>
              <Num label={v.vto ? `${v.verse}-${v.vto}` : String(v.verse)} /><Text style={ulStyle(te ? marks?.underlines[v.verse]?.te : marks?.underlines[v.verse]?.en)}>{v.text}</Text>{markers(v.verse)}
            </Text>
          </Pressable>
        </View>
      );
    });
  };
  const parallel = (d: Chapter) => {
    let prevVerse = 0;
    return alignChapter(d.te, d.en).map((r) => {
      const last = r.te?.vto ?? r.en.at(-1)?.verse ?? r.key;
      const hTe = headsBefore(d.headTe, r.key, prevVerse), hEn = headsBefore(d.headEn, r.key, prevVerse); prevVerse = last;
      const teBlock = r.te ? <Text style={teStyle}><Num label={r.label} /><Text style={ulStyle(marks?.underlines[r.key]?.te)}>{r.te.text}</Text>{markers(r.key)}</Text> : <Text style={[teStyle, { color: c.textMuted }]}>—</Text>;
      const enBlock = <Text style={enStyle(!side)}>{r.en.map((e, i) => <Text key={e.vid}>{r.en.length > 1 || !r.te || side ? <Num label={String(e.verse)} /> : null}<Text style={ulStyle(marks?.underlines[e.verse]?.en)}>{e.text}</Text>{i < r.en.length - 1 ? " " : ""}</Text>)}</Text>;
      return (
        <View key={r.key} onLayout={(e) => onRowLayout(r.key, e.nativeEvent.layout.y)}>
          {side ? (
            <View style={{ flexDirection: "row", gap: 18 }}>
              <View style={{ flex: 1 }}>{hTe.map((h, i) => <HeadingView key={i} h={h} te />)}</View>
              <View style={{ flex: 1 }}>{hEn.map((h, i) => <HeadingView key={i} h={h} te={false} />)}</View>
            </View>
          ) : <>{hTe.map((h, i) => <HeadingView key={"t" + i} h={h} te />)}{hEn.slice(0, 1).map((h, i) => <Text key={"e" + i} style={{ fontFamily: fonts.displayItalic, fontSize: size * 0.9, color: c.textMuted, marginTop: -2, marginBottom: 6 }}>{h.text}</Text>)}</>}
          <Pressable onPress={() => toggle(r.key)} accessibilityRole="button" accessibilityState={{ selected: isSel(r.key) }} accessibilityLabel={`Select verse ${r.label}`}
            style={[side ? { flexDirection: "row", gap: 18 } : null, { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: isSel(r.key) ? c.gold : "transparent", backgroundColor: hlBg(r.key) ?? (hi(r.key, last) ? c.goldSoft : "transparent"), borderBottomWidth: isSel(r.key) ? 1.5 : side ? 0 : 0.5, borderBottomColor: isSel(r.key) ? c.gold : c.border }]}>
            <View style={side ? { flex: 1 } : null}>{teBlock}</View>
            <View style={side ? { flex: 1 } : { marginTop: 4 }}>{enBlock}</View>
          </Pressable>
        </View>
      );
    });
  };

  // ---------------------------------------------------------------- verse actions
  const selectedKeys = (): M.VerseKey[] => {
    const out = new Set<number>();
    for (const k of sel) {
      const teRow = data?.te.find((v) => v.verse === k);
      const last = mode === "english" ? k : teRow?.vto ?? k;
      for (let n = k; n <= last; n++) out.add(n);
    }
    return [...out].sort((a2, b2) => a2 - b2).map((verse) => ({ book: book.code, chapter, verse }));
  };
  const selLabel = () => {
    const vs = selectedKeys().map((k) => k.verse);
    if (!vs.length) return "";
    const contiguous = vs[vs.length - 1] - vs[0] === vs.length - 1;
    return `${book.name} ${chapter}:${contiguous && vs.length > 1 ? `${vs[0]}-${vs[vs.length - 1]}` : vs.join(", ")}`;
  };
  const selKeys = sel.size ? selectedKeys() : [];
  const allHl = selKeys.length && selKeys.every((k) => marks?.highlights[k.verse] === marks?.highlights[selKeys[0].verse]) ? marks?.highlights[selKeys[0].verse] : undefined;
  const ulOn = (u?: M.Underline) => (mode === "telugu" ? !!u?.te : mode === "english" ? !!u?.en : !!u?.te && !!u?.en);
  const allUl = selKeys.length > 0 && selKeys.every((k) => ulOn(marks?.underlines[k.verse]));
  const allBm = selKeys.length > 0 && selKeys.every((k) => marks?.bookmarked.has(k.verse));
  const after = async (msg?: string, clear = true) => { await reloadMarks(); if (clear) setSel(new Set()); if (msg) setToast(msg); };
  const onHighlight = async (col: HighlightColor | null) => { await M.setHighlight(userDb, selKeys, col); await after(col ? "Highlighted" : "Highlight removed"); };
  const onAction = async (a: Action) => {
    if (a === "underline") {
      const on = !allUl;
      await M.setUnderlines(userDb, selKeys, (u) => mode === "telugu" ? { ...u, te: on } : mode === "english" ? { ...u, en: on } : { te: on, en: on });
      return after(on ? (mode === "parallel" ? "Underlined in Telugu and English" : "Underlined") : "Underline removed");
    }
    if (a === "bookmark") { await M.setVerseBookmarks(userDb, selKeys, !allBm); return after(allBm ? "Bookmark removed" : "Bookmarked"); }
    if (a === "note") { const id = await M.createNote(userDb, selKeys[0]); setSel(new Set()); return router.push(`/note/${id}`); }
    if (a === "collection") return setPicker(true);
    const text = M.shareText({
      teBookName: names?.[TE]?.[book.code]?.short_name, enBookName: book.name, chapter, mode, teLabel: pair.te?.short_name, enLabel: pair.en?.short_name,
      verses: selKeys.map((k) => ({ verse: k.verse, te: data?.te.find((v) => v.verse === k.verse)?.text, en: data?.en.find((v) => v.verse === k.verse)?.text })),
    });
    if (a === "copy") { await Clipboard.setStringAsync(text); return after("Copied"); }
    if (a === "share") {
      if (Platform.OS === "web" && !(navigator as any).share) { await Clipboard.setStringAsync(text); return after("Copied (sharing isn't available here)"); }
      try { await Share.share({ message: text }); } catch {}
      return after();
    }
  };
  const chapterBookmark = async () => { await M.setChapterBookmark(userDb, book.code, chapter, !marks?.chapterBookmarked); await after(marks?.chapterBookmarked ? "Chapter removed from saved" : "Chapter saved", false); };
  const chapterNote = async () => {
    const existing = marks?.chapterNotes[0];
    if (existing) return router.push(`/note/${existing.id}`);
    const id = await M.createNote(userDb, { book: book.code, chapter }, `${book.name} ${chapter}`);
    router.push(`/note/${id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{
        title: mode === "telugu" && teName ? `${teName} ${chapter}` : `${book.name} ${chapter}`,
        headerRight: () => (
          <View style={{ flexDirection: "row", gap: 2 }}>
            <Pressable onPress={chapterBookmark} accessibilityRole="button" accessibilityState={{ selected: !!marks?.chapterBookmarked }} accessibilityLabel={marks?.chapterBookmarked ? "Remove saved chapter" : "Save chapter"} style={{ padding: 8 }}><Icon name={marks?.chapterBookmarked ? "bookmarkFilled" : "bookmark"} color={marks?.chapterBookmarked ? c.gold : c.primary} size={20} /></Pressable>
            <Pressable onPress={chapterNote} accessibilityRole="button" accessibilityLabel={marks?.chapterNotes.length ? "Open chapter note" : "Write a chapter note"} style={{ padding: 8 }}><Icon name="note" color={marks?.chapterNotes.length ? c.gold : c.primary} size={20} /></Pressable>
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

      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: sel.size ? 220 : 40 }}>
        <Text style={{ fontFamily: fonts.teluguScriptureBold, fontSize: 26, color: c.text, textAlign: "center", marginTop: 10, lineHeight: 42, display: mode === "english" ? "none" : "flex" }}>{teLong ?? ""}</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: mode === "english" ? 40 : 24, color: mode === "english" ? c.text : c.textMuted, textAlign: "center", display: mode === "telugu" ? "none" : "flex" }}>{book.name}</Text>
        <Text style={{ fontFamily: fonts.uiMedium, fontSize: 13, letterSpacing: 2, color: c.gold, textAlign: "center", marginBottom: 10, marginTop: 4 }}>{mode === "telugu" ? `${chapter}వ అధ్యాయము` : `CHAPTER ${chapter}`}</Text>
        {dbError || err ? <EmptyState icon="info" title="Couldn't open the Bible" body={dbError ?? err ?? ""} /> : null}
        {!data && !dbError && !err ? <ActivityIndicator color={c.gold} style={{ marginTop: 40 }} accessibilityLabel="Loading chapter" /> : null}
        {data ? (mode === "telugu" ? single(data.te, data.headTe, true) : mode === "english" ? single(data.en, data.headEn, false) : parallel(data)) : null}
        {data ? (
          <Text style={{ fontFamily: fonts.ui, fontSize: 11.5, color: c.textMuted, textAlign: "center", marginTop: 28, lineHeight: 17 }}>
            {mode !== "english" && pair.te ? `${pair.te.name} · ${pair.te.license}` : ""}{mode === "parallel" ? "\n" : ""}{mode !== "telugu" && pair.en ? `${pair.en.name} · ${pair.en.license}` : ""}
          </Text>
        ) : null}
      </ScrollView>
      <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 14, borderTopWidth: 0.5, borderTopColor: c.border, backgroundColor: c.bg }}>
        <NavBtn to={prev} dir={-1} onGo={go} />
        <NavBtn to={next} dir={1} onGo={go} />
      </View>
      {sel.size ? <ActionBar label={selLabel()} current={allHl} underlined={allUl} bookmarked={allBm} onHighlight={onHighlight} onAction={onAction} onClose={() => setSel(new Set())} /> : null}
      {toast ? (
        <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: "absolute", alignSelf: "center", top: 60, backgroundColor: c.text, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 }}>
          <Text style={{ fontFamily: fonts.uiMedium, fontSize: 13.5, color: c.bg }}>{toast}</Text>
        </View>
      ) : null}
      <CollectionPicker visible={picker} label={selLabel()} onClose={() => setPicker(false)}
        onPick={async (id, name) => { await M.addToCollection(userDb, id, selKeys); setPicker(false); await after(`Saved to ${name}`); }} />
    </View>
  );
}
