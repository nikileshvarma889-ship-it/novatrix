import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";

export const GET = route({}, async ({ req, user }) => {
  const account = req.nextUrl.searchParams.get("accountId");
  const status = req.nextUrl.searchParams.get("status") ?? "open";
  return json(await sql`select i.*, a.name as account_name from inbox_items i join social_accounts a on a.id = i.social_account_id
    where i.workspace_id = ${user.workspaceId} ${account ? sql`and i.social_account_id = ${account}` : sql``} ${status !== "all" ? sql`and i.status = ${status}` : sql``}
    order by i.received_at desc limit 200`);
});
