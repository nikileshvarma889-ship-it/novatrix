import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";

export const GET = route({}, async ({ req, user }) => {
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  return json(await sql`select p.id, p.video_id, p.platform, p.status, p.scheduled_at, p.published_at, p.external_url, p.error, p.attempts,
      v.title, v.thumbnail_media_id, v.status as video_status, a.name as account_name
    from publications p join videos v on v.id = p.video_id join social_accounts a on a.id = p.social_account_id
    where p.workspace_id = ${user.workspaceId}
      ${from ? sql`and coalesce(p.scheduled_at, p.created_at) >= ${from}` : sql``} ${to ? sql`and coalesce(p.scheduled_at, p.created_at) < ${to}` : sql``}
    order by coalesce(p.scheduled_at, p.created_at) desc limit 500`);
});
