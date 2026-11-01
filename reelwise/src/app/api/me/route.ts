import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";
import { integrationStatus } from "@/lib/env";

export const GET = route({}, async ({ user }) => {
  const [n] = await sql`select count(*)::int as unread from notifications where workspace_id = ${user.workspaceId} and read_at is null`;
  const [s] = await sql`select anthropic_key_enc is not null as has_key from workspace_settings where workspace_id = ${user.workspaceId}`;
  return json({ user, unread: n.unread, integrations: { ...integrationStatus(), claudeWorkspaceKey: Boolean(s?.has_key) } });
});
