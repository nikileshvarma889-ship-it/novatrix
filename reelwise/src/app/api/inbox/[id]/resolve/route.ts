import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";
import { findItem } from "../../find";
export const POST = route<{ id: string }>({ min: "editor" }, async ({ user, params }) => {
  const item = await findItem(user.workspaceId, params.id);
  await sql`update inbox_items set status = case when status = 'resolved' then 'open' else 'resolved' end where id = ${item.id}`;
  return json({ ok: true });
});
