import { route, json, body } from "@/lib/http";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";
import { BrandSchema } from "./schema";

export const GET = route({}, async ({ user }) => json(await sql`select * from brands where workspace_id = ${user.workspaceId} order by created_at`));

export const POST = route({ min: "editor" }, async ({ req, user, ip }) => {
  const d = await body(req, BrandSchema);
  const [b] = await sql`insert into brands ${sql({ ...d, colors: sql.json(d.colors), fonts: sql.json(d.fonts), workspace_id: user.workspaceId } as never)} returning *`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "brand.create", targetType: "brand", targetId: b.id, ip });
  return json(b, 201);
});
