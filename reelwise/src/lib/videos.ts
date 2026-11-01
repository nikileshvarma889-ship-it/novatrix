// Video lifecycle shared by the API and the worker.
import { sql } from "./db";
import { enqueue } from "./jobs";
import { brandBrief, generate } from "./ai/claude";
import { STORYBOARD_SYSTEM } from "./ai/prompts";
import { StoryboardSchema, Storyboard, CINEMATIC_KINDS, PROMO_KINDS } from "./ai/schemas";

export async function brandImages(workspaceId: string, brandId: string | null) {
  if (!brandId) return [];
  return sql`select id, filename, kind from media where workspace_id = ${workspaceId} and brand_id = ${brandId} and kind in ('image','logo') order by created_at desc limit 30`;
}

/** Ask Claude for a storyboard that fits the brand, then queue a draft render. */
export async function scriptVideo(videoId: string) {
  const [v] = await sql`select * from videos where id = ${videoId}`;
  if (!v) throw new Error("Video not found");
  const [brand] = v.brand_id ? await sql`select * from brands where id = ${v.brand_id} and workspace_id = ${v.workspace_id}` : [null];
  const images = await brandImages(v.workspace_id, v.brand_id);
  await sql`update videos set status = 'scripting', error = null, updated_at = now() where id = ${videoId}`;
  const style = v.style as "cinematic3d" | "promo";
  const sb = await generate(v.workspace_id, {
    system: STORYBOARD_SYSTEM,
    effort: "medium",
    schema: StoryboardSchema,
    prompt: [
      "BRAND GUIDELINES",
      brandBrief(brand),
      "",
      "VIDEO REQUEST",
      v.instruction,
      "",
      `Style: ${style === "cinematic3d" ? `Cinematic 3D — use mainly ${CINEMATIC_KINDS.join(", ")} scenes; a promo 'cta' scene may close.` : `Promotional motion graphics — use ${PROMO_KINDS.join(", ")} scenes.`}`,
      `Aspect ratio: ${v.aspect_ratio}. Total duration: ${v.duration_sec} seconds (brand intro/outro are added automatically; do not include them).`,
      images.length ? `Available brand images (use the id for imageMediaId):\n${images.map((m) => `- ${m.id}: ${m.filename} (${m.kind})`).join("\n")}` : "No brand images are available; set imageMediaId to null.",
    ].join("\n"),
  });
  const valid = new Set(images.map((m) => m.id as string));
  const cleaned: Storyboard = {
    ...sb,
    style,
    scenes: sb.scenes.map((s, i) => ({ ...s, id: s.id || `scene-${i + 1}`, imageMediaId: s.imageMediaId && valid.has(s.imageMediaId) ? s.imageMediaId : null, durationSec: Math.max(2, Math.min(15, s.durationSec)) })),
  };
  await sql`update videos set storyboard = ${sql.json(cleaned as never)}, title = ${cleaned.title}, caption = ${cleaned.caption},
    hashtags = ${cleaned.hashtags.map((h) => h.replace(/^#/, ""))}, youtube_title = ${cleaned.youtubeTitle}, youtube_description = ${cleaned.youtubeDescription},
    thumbnail_text = ${cleaned.thumbnailText}, status = 'rendering', render_progress = 0, updated_at = now() where id = ${videoId}`;
  await enqueue("render_video", { videoId, quality: "draft" });
}

/** Text that goes out with a post, per platform. */
export function postText(v: { caption: string; hashtags: string[]; youtube_title: string; youtube_description: string; title: string }, platform: string) {
  const tags = v.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  if (platform === "youtube") return { title: v.youtube_title || v.title, description: [v.youtube_description, tags].filter(Boolean).join("\n\n") };
  return { title: v.title, description: [v.caption, tags].filter(Boolean).join("\n\n") };
}
