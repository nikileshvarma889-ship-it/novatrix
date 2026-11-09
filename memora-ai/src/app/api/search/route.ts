import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { CHAPTERS } from "@/lib/syllabus";
import { keywords } from "@/lib/retrieval";

export const runtime = "nodejs";

/** Unified search across the user's memories, notes, tasks, documents, videos and the syllabus. */
export async function GET(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return jsonError("Please sign in again.", 401);
  const { supabase } = ctx;
  const raw = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 200);
  if (!raw) return NextResponse.json({ memories: [], notes: [], tasks: [], documents: [], videos: [], chapters: [] });
  const kw = keywords(raw);
  const q = kw.join(" ") || raw;
  const like = `%${raw.replace(/[%_,()]/g, " ")}%`;
  const [memories, notes, tasks, documents, videos] = await Promise.all([
    supabase.rpc("search_memories", { q, lim: 10, include_archived: false }),
    supabase.rpc("search_notes", { q, lim: 8 }),
    supabase.from("tasks").select("id,title,kind,subject,due_at,start_at,status").or(`title.ilike.${like},description.ilike.${like}`).order("due_at", { ascending: true, nullsFirst: false }).limit(8),
    supabase.from("documents").select("id,title,status,created_at").ilike("title", like).limit(6),
    supabase.from("videos").select("video_id,title,channel_title,thumbnail_url").ilike("title", like).limit(6),
  ]);
  const terms = kw.length ? kw : [raw.toLowerCase()];
  const chapters = CHAPTERS.filter((c) => terms.some((t) => c.title.toLowerCase().includes(t))).slice(0, 8);
  return NextResponse.json({
    memories: memories.data ?? [], notes: notes.data ?? [], tasks: tasks.data ?? [], documents: documents.data ?? [], videos: videos.data ?? [], chapters,
  });
}
