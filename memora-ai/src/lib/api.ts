import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { requireUser } from "./supabase/server";
import { AiNotConfigured } from "./ai";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Simple per-user, per-route sliding window to stop runaway AI usage (per server instance).
const hits = new Map<string, number[]>();
export function rateLimited(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > limit;
}

type Ctx = NonNullable<Awaited<ReturnType<typeof requireUser>>>;

/** Wraps an API route: requires a signed-in user, validates the JSON body, rate-limits, and maps errors to safe messages. */
export function route<S extends ZodTypeAny>(
  name: string,
  schema: S | null,
  handler: (ctx: Ctx, body: output<S>, req: Request) => Promise<Response>,
  limit = 30,
) {
  return async (req: Request) => {
    try {
      const ctx = await requireUser();
      if (!ctx) return jsonError("Please sign in again.", 401);
      if (rateLimited(`${name}:${ctx.user.id}`, limit)) return jsonError("Too many requests. Please wait a minute and try again.", 429);
      let body: unknown = {};
      if (schema) {
        const raw = await req.json().catch(() => null);
        body = schema.parse(raw);
      }
      return await handler(ctx, body as never, req);
    } catch (e) {
      if (e instanceof ZodError) return jsonError("Invalid request: " + e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "), 400);
      if (e instanceof AiNotConfigured) return jsonError(e.message, 503);
      console.error(`[${name}]`, e);
      const msg = e instanceof Error && /rate limit|quota|429/i.test(e.message) ? "The AI service is busy or out of quota right now. Please try again later." : "Something went wrong. Please try again.";
      return jsonError(msg, 500);
    }
  };
}
