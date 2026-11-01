import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";

export const GET = route({}, async ({ user }) =>
  json(await sql`select * from notifications where workspace_id = ${user.workspaceId} order by created_at desc limit 40`),
);
export const POST = route({}, async ({ user }) => {
  await sql`update notifications set read_at = now() where workspace_id = ${user.workspaceId} and read_at is null`;
  return json({ ok: true });
});
