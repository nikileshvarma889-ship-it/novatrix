// Postgres-backed job queue (FOR UPDATE SKIP LOCKED) — no extra infrastructure.
import { sql } from "./db";

export type JobType = "publish_kit" | "render_video" | "script_video" | "publish" | "autopilot_tick" | "sync_analytics" | "sync_inbox" | "recycle_video" | "refresh_tokens";

export async function enqueue(type: JobType, payload: Record<string, unknown>, runAt?: Date, maxAttempts = 3) {
  const [row] = await sql`insert into jobs (type, payload, run_at, max_attempts)
    values (${type}, ${sql.json(payload as never)}, ${runAt ?? new Date()}, ${maxAttempts}) returning id`;
  return row.id as string;
}

export async function claim(workerId: string, types: JobType[]) {
  const rows = await sql`
    update jobs set status = 'running', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1, updated_at = now()
    where id = (
      select id from jobs
      where type = any(${types}) and ((status = 'queued' and run_at <= now())
         or (status = 'running' and locked_at < now() - interval '45 minutes'))   -- recover crashed workers
      order by run_at asc
      for update skip locked limit 1)
    returning *`;
  return rows[0] as { id: string; type: JobType; payload: Record<string, unknown>; attempts: number; max_attempts: number } | undefined;
}

export async function complete(id: string) {
  await sql`update jobs set status = 'done', updated_at = now() where id = ${id}`;
}

export async function fail(id: string, err: unknown, attempts: number, maxAttempts: number) {
  const msg = err instanceof Error ? err.message : String(err);
  const retry = attempts < maxAttempts;
  await sql`update jobs set status = ${retry ? "queued" : "failed"}, last_error = ${msg.slice(0, 2000)},
            run_at = now() + ${`${Math.min(60, 2 ** attempts)} minutes`}::interval, updated_at = now() where id = ${id}`;
  return retry;
}
