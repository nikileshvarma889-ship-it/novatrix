"use client";
import { useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";

/** Keeps in-app notifications up to date while the app is open; optionally mirrors new ones as browser notifications. */
export function NotificationSync() {
  const { setUnread, profile } = useProfile();
  useEffect(() => {
    let stop = false;
    const run = async () => {
      try {
        const res = await fetch("/api/notifications/sync", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        if (!res.ok || stop) return;
        const j = (await res.json()) as { unread: number; created: { title: string; body: string; link: string }[] };
        setUnread(j.unread);
        if (profile.notify_browser && "Notification" in window && Notification.permission === "granted") {
          for (const n of j.created.slice(0, 3)) {
            const note = new Notification(n.title, { body: n.body, icon: "/icons/icon-192.png", tag: n.title });
            note.onclick = () => { window.focus(); window.location.href = n.link || "/notifications"; };
          }
        }
      } catch { /* offline: try again later */ }
    };
    run();
    const id = setInterval(run, 5 * 60 * 1000);
    const vis = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [setUnread, profile.notify_browser]);
  return null;
}
