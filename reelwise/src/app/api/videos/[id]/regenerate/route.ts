import { z } from "zod/v4";
import { route, json, body } from "@/lib/http";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { findVideo } from "../../find";

/** New instructions → fresh script and render. */
export const POST = route<{ id: string }>({ min: "editor", limit: [10, 60_000] }, async ({ req, user, params }) => {
  const v = await findVideo(user.workspaceId, params.id);
  const d = await body(req, z.object({ instruction: z.string().trim().min(10).max(4000) }));
  await sql`update videos set instruction = ${d.instruction}, status = 'scripting', approved_at = null, error = null, updated_at = now() where id = ${v.id}`;
  await sql`update publications set status = 'waiting_approval' where video_id = ${v.id} and status in ('approved','scheduled')`;
  await enqueue("script_video", { videoId: v.id });
  return json({ ok: true });
});
