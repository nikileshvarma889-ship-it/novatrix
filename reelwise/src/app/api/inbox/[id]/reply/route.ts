import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";
import { accountWithToken } from "@/lib/social/accounts";
import * as meta from "@/lib/social/meta";
import * as google from "@/lib/social/google";
import { findItem } from "../../find";

/** Sends a reply the user wrote or explicitly approved (confirm must be true). */
export const POST = route<{ id: string }>({ min: "editor", limit: [30, 60_000] }, async ({ req, user, params, ip }) => {
  const item = await findItem(user.workspaceId, params.id);
  const d = await body(req, z.object({ text: z.string().trim().min(1).max(2000), confirm: z.literal(true) }));
  if (item.status === "replied") throw new HttpError(409, "You already replied to this comment.");
  const { account, token } = await accountWithToken(item.social_account_id, user.workspaceId);
  if (account.platform === "youtube") await google.replyToComment(token, item.external_id, d.text);
  else await meta.replyToComment(account.platform, item.external_id, token, d.text);
  await sql`update inbox_items set status = 'replied', reply_text = ${d.text}, replied_at = now(), replied_by = ${user.id} where id = ${item.id}`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "inbox.reply", targetType: "inbox_item", targetId: item.id, ip });
  return json({ ok: true });
});
