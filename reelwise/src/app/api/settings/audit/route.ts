import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";
export const GET = route({ min: "admin" }, async ({ user }) =>
  json(await sql`select l.id, l.action, l.target_type, l.target_id, l.ip, l.meta, l.created_at, u.email from audit_logs l left join users u on u.id = l.user_id
                 where l.workspace_id = ${user.workspaceId} order by l.id desc limit 200`),
);
