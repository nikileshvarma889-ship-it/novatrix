import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";
import { RuleSchema } from "../schema";

const Patch = z.union([z.object({ status: z.enum(["active", "paused"]) }), RuleSchema]);

export const PATCH = route<{ id: string }>({ min: "admin" }, async ({ req, user, params, ip }) => {
  const d = await body(req, Patch);
  const [r] = await sql`select id from autopilot_rules where id = ${params.id} and workspace_id = ${user.workspaceId}`;
  if (!r) throw new HttpError(404, "Rule not found.");
  if ("status" in d) await sql`update autopilot_rules set status = ${d.status}, next_run_at = ${d.status === "active" ? sql`coalesce(next_run_at, now())` : sql`next_run_at`}, updated_at = now() where id = ${r.id}`;
  else
    await sql`update autopilot_rules set name = ${d.name}, brand_id = ${d.brandId}, instruction = ${d.instruction}, platforms = ${d.platforms}, per_week = ${d.perWeek},
              publish_times = ${d.publishTimes}, style = ${d.style}, aspect_ratio = ${d.aspectRatio}, updated_at = now() where id = ${r.id}`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "autopilot.update", targetType: "autopilot_rule", targetId: r.id, ip });
  return json({ ok: true });
});

export const DELETE = route<{ id: string }>({ min: "admin" }, async ({ user, params, ip }) => {
  await sql`delete from autopilot_rules where id = ${params.id} and workspace_id = ${user.workspaceId}`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "autopilot.delete", targetType: "autopilot_rule", targetId: params.id, ip });
  return json({ ok: true });
});
