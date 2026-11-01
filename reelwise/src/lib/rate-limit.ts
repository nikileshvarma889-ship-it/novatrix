// Fixed-window limiter per key. In-memory, so per instance; put a shared
// limiter (e.g. Redis or your edge provider) in front for multi-instance deploys.
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    if (hits.size > 50_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  h.count++;
  return { ok: h.count <= limit, retryAfter: Math.ceil((h.reset - now) / 1000) };
}
