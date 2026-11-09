import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { jsonError, rateLimited } from "@/lib/api";
import { search, YtNotConfigured } from "@/lib/youtube";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return jsonError("Please sign in again.", 401);
  if (rateLimited(`yt:${ctx.user.id}`, 40)) return jsonError("Too many searches. Please wait a minute.", 429);
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const page = url.searchParams.get("page") ?? undefined;
  if (!q) return jsonError("Type something to search.");
  try {
    return NextResponse.json(await search(q, page || undefined));
  } catch (e) {
    if (e instanceof YtNotConfigured) return jsonError(e.message, 503);
    return jsonError(e instanceof Error ? e.message : "YouTube search failed.", 502);
  }
}
