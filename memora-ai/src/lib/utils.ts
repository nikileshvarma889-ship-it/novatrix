import { clsx, type ClassValue } from "clsx";

export const cn = (...v: ClassValue[]) => clsx(v);

export const SUBJECTS = [
  { id: "mathematics", name: "Mathematics", short: "Maths", color: "math", emoji: "∑" },
  { id: "physics", name: "Physics", short: "Physics", color: "phys", emoji: "⚛" },
  { id: "chemistry", name: "Chemistry", short: "Chem", color: "chem", emoji: "⚗" },
] as const;
export type SubjectId = (typeof SUBJECTS)[number]["id"];
export const subjectName = (id?: string | null) => SUBJECTS.find((s) => s.id === id)?.name ?? (id ? id[0].toUpperCase() + id.slice(1) : "General");

export const MEMORY_CATEGORIES = [
  "Personal", "Education", "Mathematics", "Physics", "Chemistry", "Assignments", "Teachers",
  "Important Information", "Ideas", "Reminders", "Projects", "General Notes",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const LEVELS = [
  { id: "inter1", name: "Intermediate 1st Year" },
  { id: "inter2", name: "Intermediate 2nd Year" },
  { id: "eapcet", name: "EAPCET Preparation" },
] as const;
export const levelName = (id?: string | null) => LEVELS.find((l) => l.id === id)?.name ?? "Intermediate";

export const LANGS = [
  { id: "en", name: "English" },
  { id: "te", name: "Telugu (తెలుగు)" },
  { id: "en_te", name: "English + Telugu" },
] as const;

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function minutesLabel(min: number) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export function errMessage(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong.";
}
