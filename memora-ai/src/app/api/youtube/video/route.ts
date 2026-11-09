import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { jsonError, rateLimited } from "@/lib/api";
import { details, search, YtNotConfigured } from "@/lib/youtube";

export const runtime = "nodejs";

/** Video details plus related lessons (found by searching the video's topic — YouTube removed its "related videos" endpoint). */
export async function GET(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return jsonError("Please sign in again.", 401);
  if (rateLimited(`ytv:${ctx.user.id}`, 40)) return jsonError("Too many requests. Please wait a minute.", 429);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return jsonError("Invalid video id.");
  try {
    const [video] = await details([id]);
    if (!video) return jsonError("Video not found or unavailable.", 404);
    const topic = video.title.replace(/[|#\[\](){}]/g, " ").split(/\s+/).slice(0, 8).join(" ");
    const related = await search(topic, undefined, 9).then((r) => r.videos.filter((v) => v.id !== id).slice(0, 8)).catch(() => []);
    return NextResponse.json({ video, related });
  } catch (e) {
    if (e instanceof YtNotConfigured) return jsonError(e.message, 503);
    return jsonError(e instanceof Error ? e.message : "Could not load the video.", 502);
  }
}
