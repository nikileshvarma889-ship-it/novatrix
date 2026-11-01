import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { currentUser } from "@/lib/session";
import { exchangeCode, listPages } from "@/lib/social/meta";
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
  if (p.get("error")) return back(p.get("error_description") || "Meta login was cancelled.");
  const [st] = await sql`delete from oauth_states where state = ${p.get("state") ?? ""} and provider = 'meta' and user_id = ${user.id}
                         and created_at > now() - interval '15 minutes' returning workspace_id`;
  if (!st) return back("This login link expired. Please try connecting again.");
  try {
    const { userToken, granted } = await exchangeCode(p.get("code") ?? "");
    const pages = await listPages(userToken);
    if (!pages.length) return back("No Facebook Pages were shared. Re-connect and select at least one Page you manage.");
    let n = 0;
    for (const page of pages) {
      await sql`insert into social_accounts (workspace_id, platform, external_id, name, avatar_url, access_token_enc, scopes, meta)
        values (${st.workspace_id}, 'facebook', ${page.id}, ${page.name}, ${page.picture?.data?.url ?? null}, ${encrypt(page.access_token)}, ${granted}, ${sql.json({} as never)})
        on conflict (workspace_id, platform, external_id) do update set name = excluded.name, avatar_url = excluded.avatar_url, access_token_enc = excluded.access_token_enc,
          scopes = excluded.scopes, status = 'connected', last_error = null, updated_at = now()`;
      n++;
      const ig = page.instagram_business_account;
      if (ig) {
        // Instagram professional accounts publish with the linked Page's token.
        await sql`insert into social_accounts (workspace_id, platform, external_id, name, avatar_url, access_token_enc, scopes, meta)
          values (${st.workspace_id}, 'instagram', ${ig.id}, ${ig.username ? `@${ig.username}` : page.name}, ${ig.profile_picture_url ?? null}, ${encrypt(page.access_token)}, ${granted}, ${sql.json({ pageId: page.id } as never)})
          on conflict (workspace_id, platform, external_id) do update set name = excluded.name, avatar_url = excluded.avatar_url, access_token_enc = excluded.access_token_enc,
            scopes = excluded.scopes, status = 'connected', last_error = null, meta = excluded.meta, updated_at = now()`;
        n++;
      }
    }
    const missing = ["pages_manage_posts", "instagram_content_publish"].filter((s) => !granted.includes(s));
    await audit({ workspaceId: st.workspace_id, userId: user.id, action: "accounts.connect_meta", meta: { accounts: n, missing } });
    return back(missing.length ? `Connected ${n} account(s), but these permissions were not granted: ${missing.join(", ")}. Publishing will fail until they are.` : `Connected ${n} account(s).`, true);
  } catch (e) {
    return back((e as Error).message);
  }
}
