// Background worker: `npm run worker`. Run one or more alongside the web app.
import os from "node:os";
import { sql } from "../src/lib/db";
import { claim, complete, enqueue, fail, JobType } from "../src/lib/jobs";
import { autopilotJob, publishJob, publishKitJob, recycleJob, refreshTokensJob, renderJob, scriptJob, syncAnalyticsJob, syncInboxJob } from "./tasks";

const id = `${os.hostname()}-${process.pid}`;
const HANDLERS: Record<JobType, (p: Record<string, unknown>) => Promise<void>> = {
  script_video: scriptJob,
  publish_kit: publishKitJob,
  render_video: renderJob,
  recycle_video: recycleJob,
  publish: publishJob,
  autopilot_tick: autopilotJob,
  sync_analytics: syncAnalyticsJob,
  sync_inbox: syncInboxJob,
  refresh_tokens: refreshTokensJob,
};
const RECURRING: [JobType, number][] = [
  ["autopilot_tick", 15 * 60_000],
  ["sync_inbox", 30 * 60_000],
  ["sync_analytics", 6 * 3600_000],
  ["refresh_tokens", 60 * 60_000],
];

async function loop(name: string, types: JobType[]) {
  for (;;) {
    const job = await claim(`${id}:${name}`, types).catch((e) => (console.error(e), undefined));
    if (!job) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    const t0 = Date.now();
    try {
      await HANDLERS[job.type](job.payload);
      await complete(job.id);
      console.log(`[${name}] ${job.type} #${job.id} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      const retry = await fail(job.id, e, job.attempts, job.max_attempts);
      console.error(`[${name}] ${job.type} #${job.id} failed (${retry ? "will retry" : "gave up"}):`, (e as Error).message);
    }
    const every = RECURRING.find(([t]) => t === job.type)?.[1];
    if (every) await enqueue(job.type, {}, new Date(Date.now() + every), 1);
  }
}

async function main() {
  // Make sure each recurring job exists exactly once.
  for (const [type] of RECURRING) {
    const [x] = await sql`select 1 from jobs where type = ${type} and status in ('queued','running')`;
    if (!x) await enqueue(type, {}, new Date(), 1);
  }
  console.log(`worker ${id} started`);
  await Promise.all([loop("render", ["render_video", "recycle_video"]), loop("main", ["script_video", "publish_kit", "publish", "autopilot_tick", "sync_analytics", "sync_inbox", "refresh_tokens"])]);
}
main();
