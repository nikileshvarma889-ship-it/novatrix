import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { audit } from "@/lib/audit";

const Patch = z.union([
  z.object({ action: z.literal("reschedule"), scheduledAt: z.iso.datetime() }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("retry") }),
]);

export const PATCH = route<{ id: string }>({ min: "editor" }, async ({ req, user, params, ip }) => {
  const d = await body(req, Patch);
  const [p] = await sql`select p.*, v.status as video_status from publications p join videos v on v.id = p.video_id where p.id = ${params.id} and p.workspace_id = ${user.workspaceId}`;
  if (!p) throw new HttpError(404, "Publication not found.");
  if (["publishing", "published"].includes(p.status)) throw new HttpError(409, "This post is already publishing or published.");
  if (d.action === "cancel") {
    await sql`update publications set status = 'cancelled', updated_at = now() where id = ${p.id}`;
  } else {
    // Only approved content can be (re)scheduled; drafts stay in "waiting for approval".
    const approved = p.video_status === "approved";
    const at = d.action === "reschedule" ? new Date(d.scheduledAt) : new Date();
    if (at.getTime() < Date.now() - 60_000) throw new HttpError(400, "Pick a time in the future.");
    await sql`update publications set scheduled_at = ${at}, status = ${approved ? "scheduled" : "waiting_approval"}, error = null, updated_at = now() where id = ${p.id}`;
    if (approved) await enqueue("publish", { publicationId: p.id }, at, 5);
  }
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: `publication.${d.action}`, targetType: "publication", targetId: p.id, ip });
  return json({ ok: true });
});
