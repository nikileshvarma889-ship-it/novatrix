import {
  LayoutDashboard, Sparkles, Brain, GraduationCap, CalendarDays, NotebookText, Youtube, Layers, ListChecks,
  TrendingUp, Bell, Settings, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; mobile?: boolean };

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles, mobile: true },
  { href: "/memories", label: "My Memories", icon: Brain, mobile: true },
  { href: "/study", label: "Study Centre", icon: GraduationCap, mobile: true },
  { href: "/planner", label: "Study Planner", icon: CalendarDays },
  { href: "/notes", label: "Notes & Documents", icon: NotebookText },
  { href: "/youtube", label: "YouTube Learning", icon: Youtube },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/quizzes", label: "Quizzes", icon: ListChecks },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");
