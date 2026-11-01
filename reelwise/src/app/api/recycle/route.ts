import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/jobs";

const Req = z.object({
  sourceMediaId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  brandId: z.uuid().nullable(),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
  clips: z.array(z.object({ start: z.number().min(0), end: z.number().positive() }).refine((c) => c.end - c.start >= 1 && c.end - c.start <= 180, "Each clip must be 1–180 seconds")).min(1).max(10),
});

/** Existing video → new format. The result goes to preview/approval like any video. */
export const POST = route({ min: "editor", limit: [10, 60_000] }, async ({ req, user }) => {
  const d = await body(req, Req);
  const [src] = await sql`select duration_sec, kind from media where id = ${d.sourceMediaId} and workspace_id = ${user.workspaceId}`;
  if (!src || src.kind !== "video") throw new HttpError(404, "Choose a video from the media library.");
  if (src.duration_sec && d.clips.some((c) => c.end > src.duration_sec + 0.5)) throw new HttpError(400, `A clip ends after the video does (${Math.round(src.duration_sec)}s).`);
  const total = d.clips.reduce((a, c) => a + c.end - c.start, 0);
  const [v] = await sql`insert into videos (workspace_id, brand_id, title, instruction, style, aspect_ratio, duration_sec, status, created_by)
    values (${user.workspaceId}, ${d.brandId}, ${d.title}, ${`Recycled ${d.clips.length} clip(s) from an existing video`}, 'promo', ${d.aspectRatio}, ${Math.round(total)}, 'rendering', ${user.id}) returning id`;
  await enqueue("recycle_video", { videoId: v.id, sourceMediaId: d.sourceMediaId, clips: d.clips });
  return json({ id: v.id }, 201);
});
