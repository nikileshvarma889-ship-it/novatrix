"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronsLeft, LogOut, Menu, Moon, Search, Sun, User, X, Mic } from "lucide-react";
import { NAV, isActive } from "./nav";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { supabaseBrowser } from "@/lib/supabase/client";
import { VoiceCapture } from "@/components/VoiceCapture";
import { NotificationSync } from "@/components/NotificationSync";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const { unread } = useProfile();

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("memora-sidebar") === "1"); } catch { /* ignore */ }
  }, []);
  useEffect(() => setMoreOpen(false), [path]);
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem("memora-sidebar", c ? "0" : "1"); } catch { /* ignore */ } return !c; });

  return (
    <div className="min-h-dvh">
      {/* desktop sidebar */}
      <aside className={cn("glass fixed inset-y-0 left-0 z-30 hidden flex-col border-y-0 border-l-0 transition-[width] duration-300 lg:flex", collapsed ? "w-[76px]" : "w-[252px]")}>
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" aria-label="MEMORA AI home"><Logo collapsed={collapsed} /></Link>
        </div>
        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link key={n.href} href={n.href} title={collapsed ? n.label : undefined}
                className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition", active ? "text-fg" : "text-muted hover:bg-surface-2/70 hover:text-fg", collapsed && "justify-center px-0")}>
                {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl border border-brand/25 bg-brand/10" transition={{ type: "spring", damping: 30, stiffness: 380 }} />}
                <n.icon className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-brand")} />
                {!collapsed && <span className="relative truncate">{n.label}</span>}
                {n.href === "/notifications" && unread > 0 && <span className={cn("relative ml-auto rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white", collapsed && "absolute right-2 top-1.5 ml-0")}>{unread > 99 ? "99+" : unread}</span>}
              </Link>
            );
          })}
        </nav>
        <button onClick={toggle} className="m-3 flex items-center justify-center gap-2 rounded-xl py-2 text-xs text-subtle hover:bg-surface-2 hover:text-fg" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <ChevronsLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />{!collapsed && "Collapse"}
        </button>
      </aside>

      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[252px]")}>
        <Topbar onVoice={() => setVoiceOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12">{children}</main>
      </div>

      {/* mobile bottom navigation */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Mobile">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => n.mobile).map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium", active ? "text-brand" : "text-muted")}>
                <n.icon className="h-5 w-5" />{n.label.replace("My ", "").replace(" Centre", "")}
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen(true)} className="relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium text-muted">
            <Menu className="h-5 w-5" />More
            {unread > 0 && <span className="absolute right-[30%] top-2 h-2 w-2 rounded-full bg-danger" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)}>
            <motion.div className="card absolute inset-x-0 bottom-0 rounded-b-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between"><Logo /><button onClick={() => setMoreOpen(false)} className="rounded-lg p-2 text-muted" aria-label="Close menu"><X className="h-5 w-5" /></button></div>
              <div className="grid grid-cols-3 gap-2">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-surface-2/50 p-3 text-center text-[11.5px] font-medium", isActive(path, n.href) ? "text-brand" : "text-fg")}>
                    <n.icon className="h-5 w-5" />{n.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <VoiceCapture open={voiceOpen} onClose={() => setVoiceOpen(false)} />
      <NotificationSync />
    </div>
  );
}

function Topbar({ onVoice }: { onVoice: () => void }) {
  const router = useRouter();
  const { profile, email, unread, avatarUrl } = useProfile();
  const { theme, setTheme } = useTheme();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  };
  const dark = theme !== "light";
  return (
    <header className="glass sticky top-0 z-20 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="lg:hidden" aria-label="Home"><Logo collapsed /></Link>
        <form className="relative hidden max-w-xl flex-1 sm:block" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }} role="search">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search memories, notes, tasks, chapters…" className="input h-10 rounded-full pl-10" aria-label="Search" />
        </form>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => router.push("/search")} className="rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-fg sm:hidden" aria-label="Search"><Search className="h-[18px] w-[18px]" /></button>
          <button onClick={onVoice} className="rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Voice memory" title="Voice memory"><Mic className="h-[18px] w-[18px]" /></button>
          <button onClick={() => setTheme(dark ? "light" : "dark")} className="rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Toggle theme" title={dark ? "Light mode" : "Dark mode"}>
            {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <Link href="/notifications" className="relative rounded-xl p-2.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />}
          </Link>
          <div className="relative ml-1" ref={ref}>
            <button onClick={() => setMenu((m) => !m)} className="rounded-full ring-brand/40 transition hover:ring-2" aria-label="Account menu"><Avatar name={profile.full_name} email={email} url={avatarUrl} size={34} /></button>
            <AnimatePresence>
              {menu && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="card absolute right-0 top-12 w-60 p-2">
                  <div className="px-3 py-2"><div className="truncate text-sm font-medium">{profile.full_name || "Student"}</div><div className="truncate text-xs text-muted">{email}</div></div>
                  <div className="my-1 h-px bg-border" />
                  <Link href="/settings" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><User className="h-4 w-4" />Profile & settings</Link>
                  <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-surface-2"><LogOut className="h-4 w-4" />Log out</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
