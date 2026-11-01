import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { audit } from "@/lib/audit";
import { StoryboardSchema } from "@/lib/ai/schemas";
import { isTelugu } from "@/lib/voices";

const Create = z.object({
  instruction: z.string().trim().min(10, "Describe the video in at least a sentence.").max(4000),
  brandId: z.uuid().nullable(),
  style: z.enum(["auto", "cinematic3d", "promo"]),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
  durationSec: z.number().int().min(5).max(120),
  voice: z.string().max(40).default("warm-male"),
  music: z.string().max(80).default(""),
  storyboard: StoryboardSchema.optional(), // manual storyboard: skips the AI step
});

export const GET = route({}, async ({ user }) =>
  json(await sql`select v.id, v.title, v.status, v.style, v.aspect_ratio, v.render_progress, v.thumbnail_media_id, v.created_at, v.updated_at, v.autopilot_rule_id, v.error, b.name as brand_name
                 from videos v left join brands b on b.id = v.brand_id where v.workspace_id = ${user.workspaceId} order by v.created_at desc limit 100`),
);

export const POST = route({ min: "editor", limit: [20, 60_000] }, async ({ req, user, ip }) => {
  const d = await body(req, Create);
  let brand: Record<string, unknown> | null = null;
  if (d.brandId) {
    brand = ((await sql`select * from brands where id = ${d.brandId} and workspace_id = ${user.workspaceId}`)[0] as Record<string, unknown>) ?? null;
    if (!brand) throw new HttpError(404, "Brand not found.");
  }
  // Telugu videos always narrate with ElevenLabs "Bunty".
  if (isTelugu(brand?.language as string | undefined, d.instruction)) d.voice = "elevenlabs";
  // "auto": brand preference first, else infer from the instruction.
  const style =
    d.style !== "auto" ? d.style : brand?.video_style && brand.video_style !== "auto" ? (brand.video_style as string) : /\b(3d|cinematic|animation|animated|character|globe|city|deliver)/i.test(d.instruction) ? "cinematic3d" : "promo";
  const [v] = await sql`insert into videos (workspace_id, brand_id, instruction, style, aspect_ratio, duration_sec, status, created_by, render_options, storyboard, title)
    values (${user.workspaceId}, ${d.brandId}, ${d.instruction}, ${style}, ${d.aspectRatio}, ${d.durationSec}, ${d.storyboard ? "rendering" : "scripting"}, ${user.id},
            ${sql.json({ voice: d.voice, music: d.music || undefined } as never)}, ${d.storyboard ? sql.json(d.storyboard as never) : null}, ${d.storyboard?.title ?? "New video"})
    returning id`;
  if (d.storyboard) {
    const s = d.storyboard;
    await sql`update videos set caption = ${s.caption}, hashtags = ${s.hashtags}, youtube_title = ${s.youtubeTitle}, youtube_description = ${s.youtubeDescription}, thumbnail_text = ${s.thumbnailText} where id = ${v.id}`;
    await enqueue("render_video", { videoId: v.id, quality: "draft" });
  } else await enqueue("script_video", { videoId: v.id });
  await audit({ workspaceId: user.workspaceId, userId: user.id, action: "video.create", targetType: "video", targetId: v.id, ip });
  return json({ id: v.id }, 201);
});
