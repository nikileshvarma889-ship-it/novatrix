import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { audit } from "@/lib/audit";
import { COVER_LAYOUTS } from "@/lib/ai/schemas";
import { findVideo } from "../../find";

type P = { id: string };

async function guard(v: Record<string, unknown>) {
  if (!v.video_media_id || !v.timeline) throw new HttpError(409, "Wait for the preview to finish rendering first.");
  const kit = v.publish_kit as { status?: string } | null;
  if (kit?.status === "generating") throw new HttpError(409, "Claude is already working on it.");
  if ((await sql`select 1 from publications where video_id = ${v.id as string} and status in ('publishing','published')`).length)
    throw new HttpError(409, "This video has already been published.");
}

async function queue(videoId: string, payload: Record<string, unknown>) {
  await sql`update videos set publish_kit = coalesce(publish_kit, '{}'::jsonb) || '{"status": "generating", "error": null}'::jsonb, updated_at = now() where id = ${videoId}`;
  await enqueue("publish_kit", { videoId, ...payload }, undefined, 2);
}

/** Ask Claude to (re)write the title, description, caption, hashtags and design a new cover. */
export const POST = route<P>({ min: "editor", limit: [10, 60_000] }, async ({ req, user, params, ip }) => {
  const v = await findVideo(user.workspaceId, params.id);
  const d = await body(req, z.object({ note: z.string().max(500).optional() }));
  await guard(v);
  await queue(v.id, { note: d.note?.trim() || undefined });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "video.publish_kit", targetType: "video", targetId: v.id, ip });
  return json({ ok: true });
});

const CoverEdit = z.object({
  headline: z.string().trim().min(1, "The cover needs a headline.").max(48),
  highlightWord: z.string().max(30).default(""),
  subline: z.string().max(48).default(""),
  layout: z.enum(COVER_LAYOUTS),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #ff7a1a."),
  sceneIndex: z.number().int().min(0),
});

/** Edit the cover by hand; only the cover image is re-rendered. */
export const PUT = route<P>({ min: "editor", limit: [20, 60_000] }, async ({ req, user, params, ip }) => {
  const v = await findVideo(user.workspaceId, params.id);
  const cover = await body(req, CoverEdit);
  await guard(v);
  const scenes = ((v.storyboard as { scenes?: unknown[] } | null)?.scenes ?? []).length;
  if (cover.sceneIndex >= scenes) throw new HttpError(400, "That scene does not exist.");
  await sql`update videos set publish_kit = coalesce(publish_kit, '{}'::jsonb) || ${sql.json({ cover, edited: true } as never)}::jsonb,
            thumbnail_text = ${cover.headline} where id = ${v.id}`;
  await queue(v.id, { coverOnly: true });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "video.cover_edit", targetType: "video", targetId: v.id, ip });
  return json({ ok: true });
});
