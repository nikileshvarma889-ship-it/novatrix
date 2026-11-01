import { route, json, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { audit } from "@/lib/audit";

/** Disconnect: wipes stored tokens and cancels pending publications for the account. */
export const DELETE = route<{ id: string }>({ min: "admin" }, async ({ user, params, ip }) => {
  const [a] = await sql`update social_accounts set status = 'disconnected', access_token_enc = 'revoked', refresh_token_enc = null, updated_at = now()
                        where id = ${params.id} and workspace_id = ${user.workspaceId} returning platform, name`;
  if (!a) throw new HttpError(404, "Account not found.");
  await sql`update publications set status = 'cancelled', error = 'Account disconnected', updated_at = now()
            where social_account_id = ${params.id} and status in ('waiting_approval','approved','scheduled')`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "accounts.disconnect", targetType: "social_account", targetId: params.id, ip, meta: a });
  return json({ ok: true });
});
