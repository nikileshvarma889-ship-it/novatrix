"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bell, Bot, CalendarDays, Clapperboard, Image as ImageIcon, Inbox, LayoutDashboard, Link2, ListChecks, LogOut, Menu, Palette, PenLine, Settings, Sparkles, X,
} from "lucide-react";
import { api, fmtDate, useApi } from "./ui";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Connected Accounts", icon: Link2 },
  { href: "/brands", label: "Brand Studio", icon: Palette },
  { href: "/create", label: "AI Video Creator", icon: Clapperboard },
  { href: "/content", label: "Content Generator", icon: PenLine },
  { href: "/calendar", label: "Content Calendar", icon: CalendarDays },
  { href: "/queue", label: "Publishing Queue", icon: ListChecks },
  { href: "/autopilot", label: "Auto Pilot", icon: Bot },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/inbox", label: "Smart Inbox", icon: Inbox },
  { href: "/media", label: "Media Library", icon: ImageIcon },
  { href: "/settings", label: "Settings", icon: Settings },
];

type Me = { user: { name: string; email: string; workspaceName: string; role: string }; unread: number };
type Note = { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };

function Notifications({ unread, onRead }: { unread: number; onRead: () => void }) {
  const [open, setOpen] = useState(false);
  const { data, reload } = useApi<Note[]>(open ? "/api/notifications" : null);
  return (
    <div className="relative">
      <button
        className="btn-ghost relative !p-2.5"
        aria-label="Notifications"
        onClick={async () => {
          setOpen(!open);
          if (!open && unread) {
            await api("/api/notifications", { method: "POST" });
            onRead();
            reload();
          }
        }}
      >
        <Bell className="h-5 w-5" />
        {unread ? <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-lilac-500 px-1 text-[10px] font-bold text-white">{unread}</span> : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass absolute right-0 z-40 mt-2 w-80 rounded-2xl p-2">
            {!data?.length ? <div className="p-4 text-sm text-ink-soft">No notifications yet.</div> : null}
            {data?.map((n) => (
              <Link key={n.id} href={n.link?.startsWith("/") ? n.link : "#"} onClick={() => setOpen(false)} className="block rounded-xl p-3 hover:bg-brand-50">
                <div className="text-sm font-semibold">{n.title}</div>
                {n.body ? <div className="text-xs text-ink-soft">{n.body}</div> : null}
                <div className="mt-1 text-[11px] text-ink-faint">{fmtDate(n.created_at)}</div>
              </Link>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const { data: me, reload } = useApi<Me>("/api/me", 30_000);
  useEffect(() => setDrawer(false), [path]);
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };
  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-white text-ink shadow-soft" : "text-ink-soft hover:bg-white/60 hover:text-ink",
            )}
          >
            <Icon className={clsx("h-[18px] w-[18px]", active ? "text-brand-500" : "text-ink-faint group-hover:text-brand-500")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
  const brand = (
    <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-lilac-500 text-white shadow-lift">
        <Sparkles className="h-5 w-5" />
      </div>
      <div>
        <div className="font-display text-base font-extrabold leading-none">Reelwise</div>
        <div className="mt-0.5 text-[11px] text-ink-faint">{me?.user.workspaceName ?? " "}</div>
      </div>
    </Link>
  );
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/60 bg-white/40 p-4 backdrop-blur-xl lg:flex">
        {brand}
        {nav}
        <button onClick={logout} className="btn-ghost mt-2 justify-start">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
      <AnimatePresence>
        {drawer ? (
          <motion.div className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)}>
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="flex h-full w-72 flex-col overflow-y-auto bg-[#f7f9ff] p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                {brand}
                <button className="btn-ghost !p-2" onClick={() => setDrawer(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              <button onClick={logout} className="btn-ghost mt-2 justify-start">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/60 bg-white/50 px-4 py-2.5 backdrop-blur-xl md:px-8" style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}>
          <button className="btn-ghost !p-2.5 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <Link href="/create" className="btn-primary hidden !py-2 sm:inline-flex">
            <Clapperboard className="h-4 w-4" /> New video
          </Link>
          <Notifications unread={me?.unread ?? 0} onRead={reload} />
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold leading-tight">{me?.user.name}</div>
            <div className="text-[11px] capitalize text-ink-faint">{me?.user.role}</div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
