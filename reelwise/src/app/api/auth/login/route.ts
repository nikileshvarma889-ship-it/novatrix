import { NextRequest } from "next/server";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/session";
import { body, clientIp, errorResponse, HttpError, json } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

const Schema = z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().max(200) });

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const d = await body(req, Schema);
    if (!rateLimit(`login:${ip}`, 20, 900_000).ok || !rateLimit(`login:${d.email}`, 8, 900_000).ok)
      throw new HttpError(429, "Too many sign-in attempts. Wait 15 minutes and try again.");
    const [u] = await sql`select id, password_hash from users where email = ${d.email}`;
    // Same message for unknown email and wrong password.
    if (!u || !(await verifyPassword(d.password, u.password_hash))) {
      await audit({ action: "auth.login_failed", ip, meta: { email: d.email } });
      throw new HttpError(401, "Email or password is incorrect.");
    }
    await createSession(u.id);
    await audit({ userId: u.id, action: "auth.login", ip });
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
