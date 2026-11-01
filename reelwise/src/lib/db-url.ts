// Normalises DATABASE_URL for postgres.js so hosted databases work as pasted:
// libpq-only parameters (e.g. Neon's channel_binding) would otherwise be sent to the
// server as session settings and rejected; PgBouncer-style poolers need prepare=false.
const LIBPQ_ONLY = ["channel_binding", "gssencmode", "sslcert", "sslkey", "sslrootcert", "sslcrl", "target_session_attrs", "options"];

export function pgConnection(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: raw, prepare: true };
  }
  for (const k of LIBPQ_ONLY) url.searchParams.delete(k);
  const pooled = /-pooler\.|pgbouncer=true|:6543\b/.test(raw);
  url.searchParams.delete("pgbouncer");
  return { url: url.toString(), prepare: !pooled };
}
