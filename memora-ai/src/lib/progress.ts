import { CHAPTERS, type Chapter } from "./syllabus";

export type Level = "inter1" | "inter2" | "eapcet";
export const trackFor = (level: Level) => (level === "eapcet" ? "eapcet" : "inter");
export function chaptersForLevel(level: Level, subject?: string): Chapter[] {
  return CHAPTERS.filter((c) => (!subject || c.subject === subject) && (level === "eapcet" || c.year === (level === "inter1" ? 1 : 2)));
}
export type ProgressRow = { chapter_id: string; track: string; status: string; important: boolean; personal_notes: string; revision_due: string | null; completed_at: string | null };

export function subjectStats(rows: ProgressRow[], level: Level, subject: string) {
  const chs = chaptersForLevel(level, subject);
  const map = new Map(rows.filter((r) => r.track === trackFor(level)).map((r) => [r.chapter_id, r]));
  const completed = chs.filter((c) => map.get(c.id)?.status === "completed").length;
  const inProgress = chs.filter((c) => map.get(c.id)?.status === "in_progress").length;
  return { total: chs.length, completed, inProgress, pending: chs.length - completed, pct: chs.length ? Math.round((completed / chs.length) * 100) : 0, map, chapters: chs };
}
