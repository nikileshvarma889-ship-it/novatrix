import "server-only";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { sql } from "./db";
import { randomToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "rw_session";
const SESSION_DAYS = 30;

export type Role = "owner" | "admin" | "editor" | "viewer";
export type SessionUser = { id: string; email: string; name: string; workspaceId: string; workspaceName: string; role: Role };

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  await sql`insert into sessions (id, user_id, expires_at, ip, user_agent)
            values (${sha256(token)}, ${userId}, now() + ${`${SESSION_DAYS} days`}::interval,
                    ${h.get("x-forwarded-for")?.split(",")[0] ?? null}, ${h.get("user-agent")?.slice(0, 300) ?? null})`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where id = ${sha256(token)}`;
  c.delete(SESSION_COOKIE);
}

/** The signed-in user and their (first) workspace, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql`
    select u.id, u.email, u.name, w.id as workspace_id, w.name as workspace_name, m.role
    from sessions s
    join users u on u.id = s.user_id
    join memberships m on m.user_id = u.id
    join workspaces w on w.id = m.workspace_id
    where s.id = ${sha256(token)} and s.expires_at > now()
    order by m.created_at asc limit 1`;
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, email: r.email, name: r.name, workspaceId: r.workspace_id, workspaceName: r.workspace_name, role: r.role };
}

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };
export const hasRole = (u: SessionUser, min: Role) => RANK[u.role] >= RANK[min];
