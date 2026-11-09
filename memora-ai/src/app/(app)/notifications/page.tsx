"use client";
import Link from "next/link";
import { useState } from "react";
import { Bell, BellRing, BookOpen, CalendarClock, CheckCheck, ClipboardList, GraduationCap, Info, Trash2, Trophy } from "lucide-react";
import { Button, Card, Empty, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useData, must } from "@/hooks/useData";
import { useProfile } from "@/hooks/useProfile";
import { relative } from "@/lib/dates";
import { cn } from "@/lib/utils";

type N = { id: string; type: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };
const ICON: Record<string, typeof Bell> = { reminder: BellRing, assignment: ClipboardList, revision: BookOpen, study: CalendarClock, exam: GraduationCap, achievement: Trophy, system: Info };

export default function NotificationsPage() {
  const toast = useToast();
  const { setUnread, profile, update } = useProfile();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const { data, loading, setData } = useData(async () => must(await supabaseBrowser().from("notifications").select("*").order("created_at", { ascending: false }).limit(200)) as N[]);
  const list = (data ?? []).filter((n) => tab === "all" || !n.read_at);
  const sync = (d: N[]) => setUnread(d.filter((n) => !n.read_at).length);

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    const now = new Date().toISOString();
    const { error } = await supabaseBrowser().from("notifications").update({ read_at: now }).in("id", ids);
    if (error) return toast(error.message, "error");
    setData((d) => { const x = (d ?? []).map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)); sync(x); return x; });
  };
  const remove = async (n: N) => {
    const { error } = await supabaseBrowser().from("notifications").delete().eq("id", n.id);
    if (error) return toast(error.message, "error");
    setData((d) => { const x = (d ?? []).filter((y) => y.id !== n.id); sync(x); return x; });
  };
  const clearRead = async () => {
    const { error } = await supabaseBrowser().from("notifications").delete().not("read_at", "is", null);
    if (error) return toast(error.message, "error");
    setData((d) => (d ?? []).filter((n) => !n.read_at));
  };
  const enableBrowser = async () => {
    if (!("Notification" in window)) return toast("This browser doesn't support notifications.", "error");
    const p = await Notification.requestPermission();
    if (p !== "granted") return toast("Permission not granted. You'll still see notifications inside MEMORA.", "info");
    const { error } = await update({ notify_browser: true });
    if (error) toast(error, "error"); else toast("Browser alerts enabled while MEMORA is open.");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" sub="Reminders, deadlines, revision and exam alerts — created from your own schedule." icon={<Bell className="h-5 w-5" />}
        actions={<><Button variant="secondary" onClick={() => markRead((data ?? []).filter((n) => !n.read_at).map((n) => n.id))}><CheckCheck className="h-4 w-4" />Mark all read</Button><Button variant="ghost" onClick={clearRead}><Trash2 className="h-4 w-4" />Clear read</Button></>} />
      {!profile.notify_browser && (
        <Card className="flex flex-col gap-3 border-brand/30 p-4 sm:flex-row sm:items-center">
          <BellRing className="h-6 w-6 shrink-0 text-brand" />
          <div className="flex-1 text-sm"><div className="font-medium">Get a pop-up when a reminder is due</div><div className="text-muted">Shows system notifications while MEMORA is open in a tab or installed as an app.</div></div>
          <Button size="sm" onClick={enableBrowser}>Enable</Button>
        </Card>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "all", label: "All" }, { id: "unread", label: `Unread (${(data ?? []).filter((n) => !n.read_at).length})` }]} className="w-fit" />
      {loading ? <Skeleton className="h-60" /> : !list.length ? <Empty icon={<Bell className="h-5 w-5" />} title={tab === "unread" ? "You're all caught up" : "No notifications yet"} text="Set due dates and reminders in the planner, schedule chapter revisions, or add flashcards — alerts appear here automatically." /> : (
        <div className="space-y-2">
          {list.map((n) => {
            const I = ICON[n.type] ?? Bell;
            const inner = (
              <>
                <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", n.read_at ? "bg-surface-2 text-muted" : "bg-brand/15 text-brand")}><I className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><div className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</div>{n.body && <div className="text-xs text-muted">{n.body}</div>}<div className="mt-0.5 text-[11px] text-subtle">{relative(n.created_at)}</div></div>
              </>
            );
            return (
              <div key={n.id} className={cn("card group flex items-center gap-3 p-3.5", !n.read_at && "border-brand/30")}>
                {n.link ? <Link href={n.link} onClick={() => !n.read_at && markRead([n.id])} className="flex min-w-0 flex-1 items-center gap-3">{inner}</Link> : <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>}
                {!n.read_at && <button onClick={() => markRead([n.id])} className="rounded-md p-1.5 text-muted hover:text-ok" aria-label="Mark read" title="Mark read"><CheckCheck className="h-4 w-4" /></button>}
                <button onClick={() => remove(n)} className="rounded-md p-1.5 text-muted hover:text-danger sm:opacity-0 sm:group-hover:opacity-100" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
