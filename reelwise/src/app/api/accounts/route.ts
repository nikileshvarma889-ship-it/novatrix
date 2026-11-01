import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";

// Tokens never leave the server: only safe columns are selected.
export const GET = route({}, async ({ user }) =>
  json(await sql`select id, platform, external_id, name, avatar_url, status, last_error, scopes, token_expires_at, meta, created_at, updated_at
                 from social_accounts where workspace_id = ${user.workspaceId} and status <> 'disconnected' order by platform, name`),
);
