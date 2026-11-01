import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { currentUser } from "@/lib/session";
import { exchangeCode, myChannel, GOOGLE_SCOPES } from "@/lib/social/google";
import { audit } from "@/lib/audit";

const back = (msg: string, ok = false) => {
  const u = new URL(`${process.env.APP_URL || "http://localhost:3000"}/accounts`);
  u.searchParams.set(ok ? "connected" : "error", msg);
  return NextResponse.redirect(u);
};

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const user = await currentUser();
  if (!user) return back("Please sign in again and retry.");
  if (p.get("error")) return back(p.get("error") === "access_denied" ? "Google sign-in was cancelled." : `Google error: ${p.get("error")}`);
  const [st] = await sql`delete from oauth_states where state = ${p.get("state") ?? ""} and provider = 'google' and user_id = ${user.id}
                         and created_at > now() - interval '15 minutes' returning workspace_id, code_verifier`;
  if (!st) return back("This login link expired. Please try connecting again.");
  try {
    const t = await exchangeCode(p.get("code") ?? "", st.code_verifier);
    const granted = t.scope.split(" ");
    const missing = GOOGLE_SCOPES.filter((s) => !granted.includes(s));
    if (!t.refresh_token) return back("Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and connect again.");
    const ch = await myChannel(t.access_token);
    await sql`insert into social_accounts (workspace_id, platform, external_id, name, avatar_url, access_token_enc, refresh_token_enc, token_expires_at, scopes, meta)
      values (${st.workspace_id}, 'youtube', ${ch.id}, ${ch.snippet.title}, ${ch.snippet.thumbnails?.default?.url ?? null}, ${encrypt(t.access_token)}, ${encrypt(t.refresh_token)},
              now() + ${`${t.expires_in} seconds`}::interval, ${granted}, ${sql.json({ statistics: ch.statistics ?? {} } as never)})
      on conflict (workspace_id, platform, external_id) do update set name = excluded.name, avatar_url = excluded.avatar_url, access_token_enc = excluded.access_token_enc,
        refresh_token_enc = excluded.refresh_token_enc, token_expires_at = excluded.token_expires_at, scopes = excluded.scopes, status = 'connected', last_error = null, meta = excluded.meta, updated_at = now()`;
    await audit({ workspaceId: st.workspace_id, userId: user.id, action: "accounts.connect_youtube", meta: { channel: ch.id, missing } });
    return back(missing.length ? `Connected ${ch.snippet.title}, but some permissions were declined (${missing.length}). Uploads or analytics may fail.` : `Connected YouTube channel ${ch.snippet.title}.`, true);
  } catch (e) {
    return back((e as Error).message);
  }
}
