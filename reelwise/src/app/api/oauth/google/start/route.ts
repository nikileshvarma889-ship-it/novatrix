import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { sql } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { authUrl, pkce } from "@/lib/social/google";

export const GET = route({ min: "admin" }, async ({ user }) => {
  const state = randomToken(24);
  const { verifier, challenge } = pkce();
  await sql`insert into oauth_states (state, workspace_id, user_id, provider, code_verifier) values (${state}, ${user.workspaceId}, ${user.id}, 'google', ${verifier})`;
  return NextResponse.redirect(authUrl(state, challenge));
});
