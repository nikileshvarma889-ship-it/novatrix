// Loads a connected account with a valid access token, refreshing when possible.
import { sql } from "../db";
import { decrypt, encrypt } from "../crypto";
import { PlatformError } from "./errors";
import * as google from "./google";

export type Account = { id: string; workspace_id: string; platform: "facebook" | "instagram" | "youtube"; external_id: string; name: string; meta: Record<string, unknown> };

export async function accountWithToken(accountId: string, workspaceId: string): Promise<{ account: Account; token: string }> {
  const [a] = await sql`select * from social_accounts where id = ${accountId} and workspace_id = ${workspaceId}`;
  if (!a) throw new PlatformError("app", "Connected account not found.");
  if (a.status === "disconnected") throw new PlatformError(a.platform, "This account was disconnected.");
  let token = decrypt(a.access_token_enc);
  const expiring = a.token_expires_at && new Date(a.token_expires_at).getTime() < Date.now() + 120_000;
  if (expiring) {
    if (a.platform === "youtube" && a.refresh_token_enc) {
      try {
        const t = await google.refresh(decrypt(a.refresh_token_enc));
        token = t.access_token;
        await sql`update social_accounts set access_token_enc = ${encrypt(token)}, token_expires_at = now() + ${`${t.expires_in} seconds`}::interval, status = 'connected', last_error = null, updated_at = now() where id = ${a.id}`;
      } catch (e) {
        await markError(a.id, e);
        throw e;
      }
    } else {
      await sql`update social_accounts set status = 'expired', last_error = 'Access expired. Reconnect this account.', updated_at = now() where id = ${a.id}`;
      throw new PlatformError(a.platform, "Access to this account expired. Reconnect it on the Connected Accounts page.", undefined, true);
    }
  }
  return { account: a as unknown as Account, token };
}

export async function markError(accountId: string, e: unknown) {
  const expired = e instanceof PlatformError && e.expired;
  const msg = e instanceof Error ? e.message : String(e);
  await sql`update social_accounts set status = ${expired ? "expired" : "error"}, last_error = ${msg.slice(0, 500)}, updated_at = now() where id = ${accountId}`;
}
