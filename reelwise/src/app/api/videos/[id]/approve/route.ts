import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { audit } from "@/lib/audit";
import { findVideo } from "../../find";

const Approve = z.object({
  accountIds: z.array(z.uuid()).min(1, "Choose at least one account to publish to."),
  scheduleAt: z.iso.datetime().nullable(), // null = publish now
  confirm: z.literal(true, { error: "Explicit confirmation is required to publish." }),
});

/** The only path to publishing: an explicit human approval. */
export const POST = route<{ id: string }>({ min: "editor", limit: [20, 60_000] }, async ({ req, user, params, ip }) => {
  const v = await findVideo(user.workspaceId, params.id);
  const d = await body(req, Approve);
  if (!["ready", "approved"].includes(v.status) || !v.video_media_id) throw new HttpError(409, "Watch the finished preview before approving. The video is not ready yet.");
  const when = d.scheduleAt ? new Date(d.scheduleAt) : new Date();
  if (d.scheduleAt && when.getTime() < Date.now() - 60_000) throw new HttpError(400, "The scheduled time is in the past.");
  const accounts = await sql`select id, platform, status, name from social_accounts where workspace_id = ${user.workspaceId} and id = any(${d.accountIds})`;
  if (accounts.length !== d.accountIds.length) throw new HttpError(404, "One of the selected accounts was not found.");
  const bad = accounts.find((a) => a.status !== "connected");
  if (bad) throw new HttpError(409, `${bad.name} needs to be reconnected before publishing.`);

  await sql`update videos set status = 'approved', approved_by = ${user.id}, approved_at = now(), updated_at = now() where id = ${v.id}`;
  if (v.render_quality !== "final") await enqueue("render_video", { videoId: v.id, quality: "final" });
  const created: string[] = [];
  for (const a of accounts) {
    const [existing] = await sql`select id from publications where video_id = ${v.id} and social_account_id = ${a.id} and status in ('waiting_approval','approved','scheduled','failed')`;
    const status = d.scheduleAt ? "scheduled" : "approved";
    const [pub] = existing
      ? await sql`update publications set status = ${status}, scheduled_at = ${when}, error = null, updated_at = now() where id = ${existing.id} returning id`
      : await sql`insert into publications (workspace_id, video_id, social_account_id, platform, status, scheduled_at, created_by)
                  values (${user.workspaceId}, ${v.id}, ${a.id}, ${a.platform}, ${status}, ${when}, ${user.id}) returning id`;
    await enqueue("publish", { publicationId: pub.id }, when, 5);
    created.push(pub.id);
  }
  // Publications for accounts not chosen this time are cancelled, never published silently.
  await sql`update publications set status = 'cancelled', updated_at = now() where video_id = ${v.id} and status = 'waiting_approval' and not (id = any(${created}))`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "video.approve", targetType: "video", targetId: v.id, ip, meta: { accounts: d.accountIds, scheduleAt: d.scheduleAt } });
  return json({ ok: true, publications: created });
});
