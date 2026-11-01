import { NextRequest } from "next/server";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/session";
import { body, clientIp, errorResponse, HttpError, json } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

const Schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200).transform((e) => e.toLowerCase()),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  workspace: z.string().trim().min(1).max(80),
});

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (!rateLimit(`signup:${ip}`, 5, 3600_000).ok) throw new HttpError(429, "Too many sign-ups from this network. Try again later.");
    const d = await body(req, Schema);
    const [exists] = await sql`select 1 from users where email = ${d.email}`;
    if (exists) throw new HttpError(409, "An account with this email already exists. Sign in instead.");
    const userId = await sql.begin(async (tx) => {
      const [u] = await tx`insert into users (email, name, password_hash) values (${d.email}, ${d.name}, ${await hashPassword(d.password)}) returning id`;
      const [w] = await tx`insert into workspaces (name) values (${d.workspace}) returning id`;
      await tx`insert into memberships (workspace_id, user_id, role) values (${w.id}, ${u.id}, 'owner')`;
      await tx`insert into workspace_settings (workspace_id) values (${w.id})`;
      return u.id as string;
    });
    await createSession(userId);
    await audit({ userId, action: "auth.signup", ip });
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
