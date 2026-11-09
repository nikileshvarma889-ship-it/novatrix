"use client";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Vid = { id: string; title: string; channel: string; thumbnail: string; publishedAt?: string; description?: string; duration?: number; embeddable?: boolean; views?: number };

export const CATEGORIES = [
  { id: "maths", label: "Mathematics", q: "intermediate mathematics lecture" },
  { id: "physics", label: "Physics", q: "intermediate physics lecture" },
  { id: "chemistry", label: "Chemistry", q: "intermediate chemistry lecture" },
  { id: "inter1", label: "Intermediate 1st Year", q: "intermediate first year lessons AP TS board" },
  { id: "inter2", label: "Intermediate 2nd Year", q: "intermediate second year lessons AP TS board" },
  { id: "eapcet", label: "EAPCET Preparation", q: "EAPCET preparation" },
  { id: "chapter", label: "Chapter-wise Lessons", q: "intermediate chapter wise explanation" },
  { id: "formula", label: "Formula Revision", q: "formula revision physics chemistry maths intermediate" },
  { id: "numerical", label: "Numerical Problems", q: "physics numerical problems solved intermediate" },
  { id: "pyq", label: "Previous-Year Question Explanations", q: "EAPCET previous year questions explained" },
  { id: "quick", label: "Quick Revision", q: "quick revision one shot intermediate" },
] as const;

/** Records (or updates) a video in the user's library: watch history, resume position, saved flag. */
export async function upsertVideo(v: Vid, p: Partial<{ saved: boolean; last_position_seconds: number; duration_seconds: number; watched: boolean; last_watched_at: string; subject: string | null; chapter_id: string | null }>) {
  return supabaseBrowser().from("videos").upsert(
    { video_id: v.id, title: v.title, channel_title: v.channel, thumbnail_url: v.thumbnail, ...p },
    { onConflict: "user_id,video_id" },
  );
}

export function fmtViews(n?: number) {
  if (n == null) return "";
  return n >= 1e7 ? `${(n / 1e7).toFixed(1)} Cr views` : n >= 1e5 ? `${(n / 1e5).toFixed(1)} L views` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K views` : `${n} views`;
}
