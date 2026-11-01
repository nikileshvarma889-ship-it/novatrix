import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { audit } from "@/lib/audit";
import { StoryboardSchema } from "@/lib/ai/schemas";
import { findVideo } from "../find";
import { VOICE_OPTIONS } from "@/lib/voices";

type P = { id: string };

export const GET = route<P>({}, async ({ user, params }) => {
  const v = await findVideo(user.workspaceId, params.id);
  const pubs = await sql`select p.*, a.name as account_name, a.avatar_url from publications p join social_accounts a on a.id = p.social_account_id
                         where p.video_id = ${v.id} order by p.created_at`;
  const [job] = await sql`select status, last_error, attempts from jobs where payload->>'videoId' = ${v.id} order by id desc limit 1`;
  return json({ ...v, publications: pubs, job: job ?? null, voices: VOICE_OPTIONS });
});

const Patch = z.object({
  title: z.string().max(200).optional(),
  instruction: z.string().max(4000).optional(),
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string().max(60)).max(30).optional(),
  youtube_title: z.string().max(100).optional(),
  youtube_description: z.string().max(5000).optional(),
  thumbnail_text: z.string().max(60).optional(),
  storyboard: StoryboardSchema.optional(),
  render_options: z.object({ voice: z.string().max(40).optional(), voiceoverMediaId: z.uuid().nullable().optional(), music: z.string().max(80).optional(), musicVolume: z.number().min(0).max(1).optional() }).optional(),
  rerender: z.boolean().default(false),
});

export const PATCH = route<P>({ min: "editor" }, async ({ req, user, params, ip }) => {
  const v = await findVideo(user.workspaceId, params.id);
  if (["approved"].includes(v.status) && (await sql`select 1 from publications where video_id = ${v.id} and status in ('publishing','published')`).length)
    throw new HttpError(409, "This video has already been published. Duplicate it to make changes.");
  const d = await body(req, Patch);
  const { rerender, storyboard, render_options, ...fields } = d;
  const set: Record<string, unknown> = { ...fields };
  if (storyboard) set.storyboard = sql.json(storyboard as never);
  if (render_options) set.render_options = sql.json({ ...(v.render_options ?? {}), ...render_options } as never);
  const changesVideo = Boolean(storyboard || render_options);
  if (Object.keys(set).length) await sql`update videos set ${sql(set as never)}, updated_at = now() where id = ${v.id}`;
  // Hand edits to the publishing text win: Claude won't overwrite them on the next render.
  if (["caption", "hashtags", "youtube_title", "youtube_description", "thumbnail_text"].some((k) => k in fields))
    await sql`update videos set publish_kit = coalesce(publish_kit, '{}'::jsonb) || '{"edited": true}'::jsonb where id = ${v.id}`;
  // Any change to what's on screen invalidates approval and needs a new render.
  if (changesVideo || rerender) {
    await sql`update videos set status = 'rendering', render_progress = 0, approved_at = null, approved_by = null where id = ${v.id}`;
    await sql`update publications set status = 'waiting_approval', updated_at = now() where video_id = ${v.id} and status in ('approved','scheduled')`;
    await enqueue("render_video", { videoId: v.id, quality: "draft" });
  }
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "video.edit", targetType: "video", targetId: v.id, ip, meta: { fields: Object.keys(d) } });
  return json({ ok: true, rerendering: changesVideo || rerender });
});

export const DELETE = route<P>({ min: "editor" }, async ({ user, params, ip }) => {
  const v = await findVideo(user.workspaceId, params.id);
  await sql`delete from videos where id = ${v.id}`;
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "video.delete", targetType: "video", targetId: v.id, ip });
  return json({ ok: true });
});
