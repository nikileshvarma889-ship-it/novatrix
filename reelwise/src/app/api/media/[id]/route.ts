import fs from "node:fs";
import { route, json, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { absPath } from "@/lib/storage";
import { audit } from "@/lib/audit";

export const DELETE = route<{ id: string }>({ min: "editor" }, async ({ user, params, ip }) => {
  const [m] = await sql`select path from media where id = ${params.id} and workspace_id = ${user.workspaceId}`;
  if (!m) throw new HttpError(404, "File not found.");
  const [used] = await sql`select 1 from videos where video_media_id = ${params.id} limit 1`;
  if (used) throw new HttpError(409, "This file is a rendered video in use. Delete the video instead.");
  await sql`delete from media where id = ${params.id}`;
  fs.rmSync(absPath(m.path), { force: true });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "media.delete", targetType: "media", targetId: params.id, ip });
  return json({ ok: true });
});
