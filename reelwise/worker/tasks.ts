import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { sql } from "../src/lib/db";
import { enqueue } from "../src/lib/jobs";
import { notify } from "../src/lib/audit";
import { absPath, registerFile } from "../src/lib/storage";
import { postText, scriptVideo } from "../src/lib/videos";
import { generate, brandBrief } from "../src/lib/ai/claude";
import { IdeasSchema } from "../src/lib/ai/schemas";
import { accountWithToken, markError } from "../src/lib/social/accounts";
import { PlatformError } from "../src/lib/social/errors";
import * as meta from "../src/lib/social/meta";
import * as google from "../src/lib/social/google";
import { renderVideo } from "./render";
import { ffprobeDuration } from "./audio";

type P = Record<string, unknown>;

export async function scriptJob(p: P) {
  try {
    await scriptVideo(p.videoId as string);
  } catch (e) {
    await sql`update videos set status = 'failed', error = ${(e as Error).message}, updated_at = now() where id = ${p.videoId as string}`;
    throw e;
  }
}

export async function renderJob(p: P) {
  const videoId = p.videoId as string;
  const quality = (p.quality as "draft" | "final") ?? "draft";
  await sql`update videos set status = case when status = 'approved' then 'approved' else 'rendering' end, render_progress = 0, error = null, updated_at = now() where id = ${videoId}`;
  try {
    const out = await renderVideo(videoId, quality, async (pr) => {
      await sql`update videos set render_progress = ${pr}, updated_at = now() where id = ${videoId}`;
    });
    const [v] = await sql`update videos set video_media_id = ${out.videoMedia}, thumbnail_media_id = ${out.thumbMedia}, render_quality = ${quality},
        status = case when status = 'approved' then 'approved' else 'ready' end, render_progress = 1, updated_at = now()
      where id = ${videoId} returning workspace_id, title, autopilot_rule_id, status`;
    if (quality === "draft")
      await notify(v.workspace_id, v.autopilot_rule_id ? "Auto Pilot video ready for your approval" : "Your video preview is ready", v.title, `/create/${videoId}`);
  } catch (e) {
    await sql`update videos set status = 'failed', error = ${(e as Error).message.slice(0, 1000)}, updated_at = now() where id = ${videoId}`;
    throw e;
  }
}

/** Publish one approved publication. Never runs for unapproved content. */
export async function publishJob(p: P) {
  const [pub] = await sql`select * from publications where id = ${p.publicationId as string}`;
  // Stale job (cancelled, rescheduled later, or already handled): nothing to do.
  if (!pub || !["scheduled", "approved"].includes(pub.status) || (pub.scheduled_at && new Date(pub.scheduled_at).getTime() > Date.now() + 60_000)) return;
  const [v] = await sql`select * from videos where id = ${pub.video_id}`;
  if (!v || v.status !== "approved") {
    await sql`update publications set status = 'failed', error = 'The video is not approved.', updated_at = now() where id = ${pub.id}`;
    return;
  }
  if (v.render_quality !== "final") {
    const [pending] = await sql`select 1 from jobs where type = 'render_video' and status in ('queued','running') and payload->>'videoId' = ${v.id}`;
    if (!pending) await enqueue("render_video", { videoId: v.id, quality: "final" });
    await enqueue("publish", { publicationId: pub.id }, new Date(Date.now() + 3 * 60_000), 5);
    return;
  }
  // Atomic claim: a duplicate job finds nothing to claim and exits.
  const [claimed] = await sql`update publications set status = 'publishing', attempts = attempts + 1, error = null, updated_at = now()
                              where id = ${pub.id} and status in ('scheduled','approved') and coalesce(scheduled_at, now()) <= now() + interval '1 minute' returning id`;
  if (!claimed) return;
  const [file] = await sql`select path, mime from media where id = ${v.video_media_id}`;
  try {
    const { account, token } = await accountWithToken(pub.social_account_id, pub.workspace_id);
    const text = postText(v as never, account.platform);
    const filePath = absPath(file.path);
    let result: { externalId: string; url: string | null };
    if (account.platform === "facebook") result = await meta.publishFacebookVideo(account.external_id, token, filePath, text);
    else if (account.platform === "instagram") result = await meta.publishInstagramReel(account.external_id, token, filePath, text.description);
    else {
      result = await google.uploadVideo(token, filePath, { title: text.title, description: text.description, tags: v.hashtags, privacy: "public" });
      if (v.thumbnail_media_id) {
        const [th] = await sql`select path, mime from media where id = ${v.thumbnail_media_id}`;
        await google.setThumbnail(token, result.externalId, absPath(th.path), th.mime).catch((e) => console.warn("thumbnail not set:", (e as Error).message));
      }
    }
    await sql`update publications set status = 'published', external_id = ${result.externalId}, external_url = ${result.url}, published_at = now(), updated_at = now() where id = ${pub.id}`;
    await notify(pub.workspace_id, `Published to ${account.platform}`, `${v.title} — ${account.name}`, result.url ?? undefined);
  } catch (e) {
    const msg = (e as Error).message.slice(0, 1000);
    const permanent = (e instanceof PlatformError && (e.expired || /permission|denied|not configured|rejected/i.test(msg))) || pub.attempts + 1 >= 3;
    if (e instanceof PlatformError && e.expired) await markError(pub.social_account_id, e);
    if (permanent) {
      await sql`update publications set status = 'failed', error = ${msg}, updated_at = now() where id = ${pub.id}`;
      await notify(pub.workspace_id, "Publishing failed", msg.slice(0, 200), "/queue");
      return;
    }
    // Transient: back to scheduled so the job's retry picks it up again.
    await sql`update publications set status = 'scheduled', error = ${`Retrying: ${msg}`}, updated_at = now() where id = ${pub.id}`;
    throw e;
  }
}

/** Next slot from a rule's HH:MM times, at least `minHours` from now (UTC). */
export function nextSlot(times: string[], minHours = 2, from = new Date()) {
  const earliest = from.getTime() + minHours * 3600_000;
  for (let d = 0; d < 8; d++)
    for (const hm of [...times].sort()) {
      const [h, m] = hm.split(":").map(Number);
      const t = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + d, h, m));
      if (t.getTime() >= earliest) return t;
    }
  return new Date(earliest);
}

export async function autopilotJob() {
  const due = await sql`select * from autopilot_rules where status = 'active' and (next_run_at is null or next_run_at <= now())`;
  for (const r of due) {
    try {
      const [brand] = await sql`select * from brands where id = ${r.brand_id}`;
      const recent = await sql`select title from videos where workspace_id = ${r.workspace_id} and brand_id = ${r.brand_id} order by created_at desc limit 15`;
      const { ideas } = await generate(r.workspace_id, {
        system: "You plan short social videos for a brand. Propose fresh ideas that follow the brand guidelines and do not repeat recent titles.",
        schema: IdeasSchema,
        effort: "low",
        prompt: `${brandBrief(brand)}\n\nAutomation instruction: ${r.instruction}\nRecent titles to avoid repeating:\n${recent.map((x) => `- ${x.title}`).join("\n") || "(none)"}\n\nPropose exactly 1 idea. The instruction should be a complete video brief.`,
      });
      const idea = ideas[0];
      if (!idea) throw new Error("No idea returned");
      const [v] = await sql`insert into videos (workspace_id, brand_id, title, instruction, style, aspect_ratio, duration_sec, status, autopilot_rule_id, created_by)
        values (${r.workspace_id}, ${r.brand_id}, ${idea.title}, ${idea.instruction}, ${r.style === "auto" ? (brand.video_style === "cinematic3d" ? "cinematic3d" : "promo") : r.style},
                ${r.aspect_ratio}, ${brand.duration_sec}, 'scripting', ${r.id}, ${r.created_by}) returning id`;
      const slot = nextSlot(r.publish_times);
      const accounts = await sql`select id, platform from social_accounts where workspace_id = ${r.workspace_id} and platform = any(${r.platforms}) and status = 'connected'`;
      for (const a of accounts)
        await sql`insert into publications (workspace_id, video_id, social_account_id, platform, status, scheduled_at)
                  values (${r.workspace_id}, ${v.id}, ${a.id}, ${a.platform}, 'waiting_approval', ${slot})`;
      await enqueue("script_video", { videoId: v.id });
      await sql`insert into autopilot_runs (rule_id, status, message, video_ids) values (${r.id}, 'created', ${`Drafted "${idea.title}" for ${accounts.length} account(s); waiting for approval.`}, ${[v.id]})`;
    } catch (e) {
      await sql`insert into autopilot_runs (rule_id, status, message) values (${r.id}, 'error', ${(e as Error).message.slice(0, 500)})`;
      await notify(r.workspace_id, `Auto Pilot "${r.name}" could not create a video`, (e as Error).message.slice(0, 200), "/autopilot");
    }
    const everyMs = (7 * 24 * 3600_000) / r.per_week;
    await sql`update autopilot_rules set next_run_at = now() + ${`${Math.round(everyMs / 1000)} seconds`}::interval, updated_at = now() where id = ${r.id}`;
  }
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function syncAnalyticsJob() {
  const accounts = await sql`select id, workspace_id, platform, external_id from social_accounts where status = 'connected'`;
  for (const a of accounts) {
    try {
      const { token } = await accountWithToken(a.id, a.workspace_id);
      const end = new Date();
      const start = new Date(Date.now() - 28 * 86400_000);
      if (a.platform === "youtube") {
        const r = await google.channelAnalytics(token, isoDay(start), isoDay(end));
        const cols = r.columnHeaders.map((c) => c.name);
        for (const row of r.rows ?? []) {
          const m = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
          await sql`insert into analytics_snapshots (workspace_id, social_account_id, day, metrics) values (${a.workspace_id}, ${a.id}, ${m.day as string}, ${sql.json(m as never)})
                    on conflict (social_account_id, day) do update set metrics = excluded.metrics, fetched_at = now()`;
        }
        const ch = await google.myChannel(token);
        await sql`update social_accounts set meta = meta || ${sql.json({ statistics: ch.statistics ?? {} } as never)} where id = ${a.id}`;
      } else {
        const r = a.platform === "instagram" ? await meta.instagramInsights(a.external_id, token, start, end) : await meta.pageInsights(a.external_id, token, start, end);
        await sql`insert into analytics_snapshots (workspace_id, social_account_id, day, metrics) values (${a.workspace_id}, ${a.id}, ${isoDay(end)}, ${sql.json({ range: "28d", ...r } as never)})
                  on conflict (social_account_id, day) do update set metrics = excluded.metrics, fetched_at = now()`;
      }
      // Per-post metrics for everything we published to this account.
      const pubs = await sql`select id, external_id from publications where social_account_id = ${a.id} and status = 'published' and external_id is not null and published_at > now() - interval '90 days'`;
      for (const p of pubs) {
        const m =
          a.platform === "youtube" ? await google.videoStatistics(token, p.external_id) : a.platform === "instagram" ? await meta.instagramMediaMetrics(p.external_id, token) : await meta.facebookVideoMetrics(p.external_id, token);
        await sql`insert into post_metrics (publication_id, metrics) values (${p.id}, ${sql.json(m as never)}) on conflict (publication_id) do update set metrics = excluded.metrics, fetched_at = now()`;
      }
      await sql`update social_accounts set last_error = null where id = ${a.id}`;
    } catch (e) {
      await markError(a.id, e);
    }
  }
}

export async function syncInboxJob() {
  const accounts = await sql`select id, workspace_id, platform, external_id from social_accounts where status = 'connected'`;
  for (const a of accounts) {
    try {
      const { token } = await accountWithToken(a.id, a.workspace_id);
      const items =
        a.platform === "youtube" ? await google.recentComments(token, a.external_id) : a.platform === "instagram" ? await meta.instagramRecentComments(a.external_id, token) : await meta.pageRecentComments(a.external_id, token);
      for (const c of items as { id: string; author: string; text: string; time: string; permalink?: string; context?: string }[])
        await sql`insert into inbox_items (workspace_id, social_account_id, platform, external_id, author, text, permalink, context_title, received_at)
                  values (${a.workspace_id}, ${a.id}, ${a.platform}, ${c.id}, ${c.author}, ${c.text}, ${c.permalink ?? null}, ${c.context ?? null}, ${c.time})
                  on conflict (social_account_id, external_id) do nothing`;
    } catch (e) {
      await markError(a.id, e);
    }
  }
}

export async function refreshTokensJob() {
  const soon = await sql`select id, workspace_id from social_accounts where platform = 'youtube' and status = 'connected' and token_expires_at < now() + interval '20 minutes'`;
  for (const a of soon) await accountWithToken(a.id, a.workspace_id).catch(() => {});
}

/** Cut clips from an existing video and reformat them for the target aspect ratio. */
export async function recycleJob(p: P) {
  const videoId = p.videoId as string;
  const [v] = await sql`select * from videos where id = ${videoId}`;
  const [src] = await sql`select path from media where id = ${p.sourceMediaId as string} and workspace_id = ${v.workspace_id}`;
  if (!src) throw new Error("Source video not found");
  const clips = p.clips as { start: number; end: number }[];
  const [w, h] = v.aspect_ratio === "9:16" ? [1080, 1920] : v.aspect_ratio === "1:1" ? [1080, 1080] : [1920, 1080];
  await sql`update videos set status = 'rendering', render_progress = 0.1, updated_at = now() where id = ${videoId}`;
  try {
    const rel = path.join(v.workspace_id, `recycled-${videoId}-${Date.now()}.mp4`);
    const out = absPath(rel);
    const inputs = clips.flatMap((c) => ["-ss", String(c.start), "-to", String(c.end), "-i", absPath(src.path)]);
    // Fit each clip onto the target frame over a blurred, filled copy of itself.
    const parts = clips
      .map((_, i) => `[${i}:v]split[b${i}][f${i}];[b${i}]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=30:5[bg${i}];[f${i}]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg${i}];[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30[v${i}];[${i}:a]aresample=48000[a${i}]`)
      .join(";");
    const concat = `${clips.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${clips.length}:v=1:a=1[v][a]`;
    execFileSync("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", `${parts};${concat}`, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", out]);
    const vm = await registerFile({ workspaceId: v.workspace_id, rel, filename: `${v.title}.mp4`, mime: "video/mp4", kind: "video", source: "recycle", durationSec: ffprobeDuration(out), width: w, height: h });
    const thumbRel = path.join(v.workspace_id, `thumb-${videoId}.jpg`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "0.5", "-i", out, "-frames:v", "1", absPath(thumbRel)]);
    const tm = await registerFile({ workspaceId: v.workspace_id, rel: thumbRel, filename: "thumbnail.jpg", mime: "image/jpeg", kind: "image", source: "thumbnail" });
    await sql`update videos set video_media_id = ${vm}, thumbnail_media_id = ${tm}, status = 'ready', render_quality = 'final', render_progress = 1, updated_at = now() where id = ${videoId}`;
    await notify(v.workspace_id, "Recycled clip ready for review", v.title, `/create/${videoId}`);
  } catch (e) {
    await sql`update videos set status = 'failed', error = ${(e as Error).message.slice(0, 1000)} where id = ${videoId}`;
    throw e;
  } finally {
    void fs;
  }
}
