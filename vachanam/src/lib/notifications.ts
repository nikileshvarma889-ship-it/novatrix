import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { SQLiteDatabase } from "expo-sqlite";
import { BOOK_BY_CODE } from "../data/books";
import { loadBookNames, loadVerse, TE } from "../bible/repo";
import { makeVid, parseRef } from "./ref";
import { planDaily } from "./dailyPlan";

/** Daily verse reminders: local notifications only, scheduled only after the user turns them on and grants permission. */
export const CHANNEL = "daily-verse";
export const supported = Platform.OS === "android" || Platform.OS === "ios";
export const TITLE = "Good Morning! God has a beautiful message for you today.";

export type PermissionState = "granted" | "denied" | "undetermined" | "unsupported";

export async function permissionState(): Promise<PermissionState> {
  if (!supported) return "unsupported";
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
}

/** Called only from the user's own tap on "turn on". */
export async function askPermission(): Promise<PermissionState> {
  if (!supported) return "unsupported";
  await ensureChannel();
  const p = await Notifications.requestPermissionsAsync();
  return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
}

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Daily verse", description: "One Bible verse each morning in Telugu and English",
    importance: Notifications.AndroidImportance.DEFAULT, lightColor: "#B08A36", vibrationPattern: [0, 120],
  });
}

/** Replaces any scheduled reminders with the next 30 days, each carrying its own verse. Returns the first one. */
export async function scheduleDaily(bible: SQLiteDatabase, user: SQLiteDatabase, hour: number, minute: number, now = new Date()) {
  if (!supported) return null;
  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  const plan = planDaily(now, hour, minute, 30);
  const names = await loadBookNames(bible);
  for (const p of plan) {
    const r = parseRef(p.ref)!;
    const v = await loadVerse(bible, makeVid(r.book, r.chapter, r.verse));
    const teRef = names[TE]?.[r.book]?.short_name;
    const refLine = `${teRef ? `${teRef} ${r.chapter}:${r.verse} · ` : ""}${BOOK_BY_CODE[r.book].name} ${r.chapter}:${r.verse}`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: TITLE,
        body: [v.te, v.en, `— ${refLine}`].filter(Boolean).join("\n"),
        data: { url: `/read/${r.book}/${r.chapter}?v=${r.verse}`, ref: p.ref },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: CHANNEL },
    });
    const day = `${p.at.getFullYear()}-${String(p.at.getMonth() + 1).padStart(2, "0")}-${String(p.at.getDate()).padStart(2, "0")}`;
    await user.runAsync("INSERT OR REPLACE INTO daily_verse_log (day, ref) VALUES (?, ?)", [day, p.ref]);
  }
  return plan[0];
}

export async function cancelDaily() {
  if (supported) await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function sendTest(bible: SQLiteDatabase, ref: string) {
  if (!supported) return;
  await ensureChannel();
  const r = parseRef(ref)!;
  const v = await loadVerse(bible, makeVid(r.book, r.chapter, r.verse));
  await Notifications.scheduleNotificationAsync({
    content: { title: TITLE, body: [v.te, v.en, `— ${BOOK_BY_CODE[r.book].name} ${r.chapter}:${r.verse}`].filter(Boolean).join("\n"), data: { url: `/read/${r.book}/${r.chapter}?v=${r.verse}` } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}
