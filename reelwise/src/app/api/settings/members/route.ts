import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";

export const GET = route({}, async ({ user }) =>
  json(await sql`select u.id, u.email, u.name, m.role from memberships m join users u on u.id = m.user_id where m.workspace_id = ${user.workspaceId} order by m.created_at`),
);

/** Add an existing user (they sign up first) or change a member's role. */
export const POST = route({ min: "admin" }, async ({ req, user, ip }) => {
  const d = await body(req, z.object({ email: z.email().toLowerCase(), role: z.enum(["admin", "editor", "viewer"]) }));
  const [u] = await sql`select id from users where email = ${d.email}`;
  if (!u) throw new HttpError(404, "No account uses that email yet. Ask them to sign up first, then add them here.");
  if (u.id === user.id) throw new HttpError(400, "You can't change your own role.");
  const [m] = await sql`select role from memberships where workspace_id = ${user.workspaceId} and user_id = ${u.id}`;
  if (m?.role === "owner") throw new HttpError(403, "The owner's role can't be changed.");
  await sql`insert into memberships (workspace_id, user_id, role) values (${user.workspaceId}, ${u.id}, ${d.role})
            on conflict (workspace_id, user_id) do update set role = excluded.role`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "members.set_role", targetType: "user", targetId: u.id, ip, meta: { role: d.role } });
  return json({ ok: true });
});
