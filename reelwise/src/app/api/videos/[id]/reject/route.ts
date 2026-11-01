import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";
import { findVideo } from "../../find";

export const POST = route<{ id: string }>({ min: "editor" }, async ({ user, params, ip }) => {
  const v = await findVideo(user.workspaceId, params.id);
  await sql`update videos set status = 'rejected', updated_at = now() where id = ${v.id}`;
  await sql`update publications set status = 'cancelled', updated_at = now() where video_id = ${v.id} and status in ('waiting_approval','approved','scheduled')`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "video.reject", targetType: "video", targetId: v.id, ip });
  return json({ ok: true });
});
