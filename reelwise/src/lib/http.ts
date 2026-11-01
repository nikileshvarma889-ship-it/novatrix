// Route helpers: authentication, role checks, validation, rate limiting and
// uniform error responses for every API route.
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError, ZodType } from "zod/v4";
import { currentUser, hasRole, Role, SessionUser } from "./session";
import { rateLimit } from "./rate-limit";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

type Ctx<P> = { req: NextRequest; user: SessionUser; params: P; ip: string };

/** Wrap an authenticated route. `min` is the lowest role allowed. */
export function route<P = Record<string, string>>(
  opts: { min?: Role; limit?: [number, number] },
  handler: (ctx: Ctx<P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      const ip = clientIp(req);
      const [n, ms] = opts.limit ?? [120, 60_000];
      const rl = rateLimit(`${ip}:${req.nextUrl.pathname}:${req.method}`, n, ms);
      if (!rl.ok) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
      // CSRF: state-changing requests must come from our own origin.
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        if (origin && new URL(origin).host !== req.headers.get("host")) throw new HttpError(403, "Cross-site request blocked.");
      }
      const user = await currentUser();
      if (!user) throw new HttpError(401, "Please sign in.");
      if (opts.min && !hasRole(user, opts.min)) throw new HttpError(403, `This action needs the ${opts.min} role or higher.`);
      return await handler({ req, user, params: await ctx.params, ip });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message, details: e.details }, e.status);
  if (e instanceof ZodError) return json({ error: "Please check the highlighted fields.", details: z.flattenError(e) }, 400);
  console.error(e);
  return json({ error: "Something went wrong on our side. The error has been logged." }, 500);
}

export async function body<T extends ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
  return schema.parse(data);
}
