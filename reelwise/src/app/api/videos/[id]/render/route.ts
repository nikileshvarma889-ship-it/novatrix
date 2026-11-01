import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { findVideo } from "../../find";

/** Re-render the draft (e.g. after a failed render). */
export const POST = route<{ id: string }>({ min: "editor", limit: [10, 60_000] }, async ({ user, params }) => {
  const v = await findVideo(user.workspaceId, params.id);
  if (!v.storyboard) {
    await sql`update videos set status = 'scripting', error = null where id = ${v.id}`;
    await enqueue("script_video", { videoId: v.id });
  } else {
    await sql`update videos set status = 'rendering', render_progress = 0, error = null where id = ${v.id}`;
    await enqueue("render_video", { videoId: v.id, quality: "draft" });
  }
  return json({ ok: true });
});
