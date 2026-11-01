import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";
import { RuleSchema } from "./schema";

export const GET = route({}, async ({ user }) => {
  const rules = await sql`select r.*, b.name as brand_name from autopilot_rules r join brands b on b.id = r.brand_id where r.workspace_id = ${user.workspaceId} order by r.created_at`;
  const runs = await sql`select r.* from autopilot_runs r join autopilot_rules x on x.id = r.rule_id where x.workspace_id = ${user.workspaceId} order by r.created_at desc limit 50`;
  return json({ rules, runs });
});

export const POST = route({ min: "admin" }, async ({ req, user, ip }) => {
  const d = await body(req, RuleSchema);
  const [b] = await sql`select 1 from brands where id = ${d.brandId} and workspace_id = ${user.workspaceId}`;
  if (!b) throw new HttpError(404, "Brand not found.");
  const [r] = await sql`insert into autopilot_rules (workspace_id, brand_id, name, instruction, platforms, per_week, publish_times, style, aspect_ratio, next_run_at, created_by)
    values (${user.workspaceId}, ${d.brandId}, ${d.name}, ${d.instruction}, ${d.platforms}, ${d.perWeek}, ${d.publishTimes}, ${d.style}, ${d.aspectRatio}, now(), ${user.id}) returning *`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "autopilot.create", targetType: "autopilot_rule", targetId: r.id, ip });
  return json(r, 201);
});
