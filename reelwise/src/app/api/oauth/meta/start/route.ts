import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { sql } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { authUrl } from "@/lib/social/meta";

export const GET = route({ min: "admin" }, async ({ user }) => {
  const state = randomToken(24);
  await sql`insert into oauth_states (state, workspace_id, user_id, provider) values (${state}, ${user.workspaceId}, ${user.id}, 'meta')`;
  return NextResponse.redirect(authUrl(state));
});
