import { sql } from "./db";

export async function audit(e: { workspaceId?: string | null; userId?: string | null; action: string; targetType?: string; targetId?: string; ip?: string | null; meta?: Record<string, unknown> }) {
  await sql`insert into audit_logs (workspace_id, user_id, action, target_type, target_id, ip, meta)
            values (${e.workspaceId ?? null}, ${e.userId ?? null}, ${e.action}, ${e.targetType ?? null}, ${e.targetId ?? null}, ${e.ip ?? null}, ${sql.json((e.meta ?? {}) as never)})`;
}

export async function notify(workspaceId: string, title: string, body = "", link?: string) {
  await sql`insert into notifications (workspace_id, title, body, link) values (${workspaceId}, ${title}, ${body}, ${link ?? null})`;
}
