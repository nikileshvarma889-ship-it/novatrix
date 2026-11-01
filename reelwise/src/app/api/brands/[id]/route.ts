import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";
import { BrandSchema } from "../schema";

type P = { id: string };
const find = async (ws: string, id: string) => {
  const [b] = await sql`select * from brands where id = ${id} and workspace_id = ${ws}`;
  if (!b) throw new HttpError(404, "Brand not found.");
  return b;
};

export const GET = route<P>({}, async ({ user, params }) => json(await find(user.workspaceId, params.id)));

export const PUT = route<P>({ min: "editor" }, async ({ req, user, params, ip }) => {
  await find(user.workspaceId, params.id);
  const d = await body(req, BrandSchema);
  const [b] = await sql`update brands set ${sql({ ...d, colors: sql.json(d.colors), fonts: sql.json(d.fonts) } as never)}, updated_at = now()
                        where id = ${params.id} and workspace_id = ${user.workspaceId} returning *`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "brand.update", targetType: "brand", targetId: params.id, ip });
  return json(b);
});

export const DELETE = route<P>({ min: "admin" }, async ({ user, params, ip }) => {
  await find(user.workspaceId, params.id);
  await sql`delete from brands where id = ${params.id} and workspace_id = ${user.workspaceId}`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "brand.delete", targetType: "brand", targetId: params.id, ip });
  return json({ ok: true });
});
