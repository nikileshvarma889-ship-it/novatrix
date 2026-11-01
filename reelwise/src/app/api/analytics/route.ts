import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";

/** Only data the platforms returned — no estimates, no placeholders. */
export const GET = route({}, async ({ user }) => {
  const accounts = await sql`select id, platform, name, status, last_error, meta from social_accounts where workspace_id = ${user.workspaceId} and status <> 'disconnected'`;
  const snapshots = await sql`select social_account_id, day, metrics, fetched_at from analytics_snapshots where workspace_id = ${user.workspaceId} and day > now() - interval '60 days' order by day`;
  const posts = await sql`select p.id, p.platform, p.published_at, p.external_url, v.title, m.metrics, m.fetched_at from publications p join videos v on v.id = p.video_id
                          left join post_metrics m on m.publication_id = p.id where p.workspace_id = ${user.workspaceId} and p.status = 'published' order by p.published_at desc limit 50`;
  return json({ accounts, snapshots, posts });
});
