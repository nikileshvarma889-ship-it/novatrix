import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { brandBrief, generate } from "@/lib/ai/claude";
import { STORYBOARD_SYSTEM } from "@/lib/ai/prompts";
import { SceneSchema, Storyboard } from "@/lib/ai/schemas";
import { brandImages } from "@/lib/videos";
import { findVideo } from "../../find";

/** Regenerate one scene with AI from a short note, then re-render. */
export const POST = route<{ id: string }>({ min: "editor", limit: [15, 60_000] }, async ({ req, user, params }) => {
  const v = await findVideo(user.workspaceId, params.id);
  const d = await body(req, z.object({ sceneId: z.string(), note: z.string().trim().min(3).max(1000) }));
  const sb = v.storyboard as Storyboard | null;
  const idx = sb?.scenes.findIndex((s) => s.id === d.sceneId) ?? -1;
  if (!sb || idx < 0) throw new HttpError(404, "Scene not found.");
  const [brand] = v.brand_id ? await sql`select * from brands where id = ${v.brand_id}` : [null];
  const images = await brandImages(user.workspaceId, v.brand_id);
  const scene = await generate(user.workspaceId, {
    system: STORYBOARD_SYSTEM,
    schema: SceneSchema,
    effort: "low",
    prompt: `${brandBrief(brand)}\n\nFull storyboard for context:\n${JSON.stringify(sb.scenes, null, 1)}\n\nRewrite ONLY scene "${d.sceneId}" (index ${idx}) following this note: ${d.note}\nKeep its id. Keep the duration close to ${sb.scenes[idx].durationSec}s.${images.length ? `\nImage ids: ${images.map((m) => `${m.id} (${m.filename})`).join(", ")}` : ""}`,
  });
  sb.scenes[idx] = { ...scene, id: d.sceneId, imageMediaId: scene.imageMediaId && images.some((m) => m.id === scene.imageMediaId) ? scene.imageMediaId : null };
  await sql`update videos set storyboard = ${sql.json(sb as never)}, status = 'rendering', render_progress = 0, approved_at = null, updated_at = now() where id = ${v.id}`;
  await sql`update publications set status = 'waiting_approval' where video_id = ${v.id} and status in ('approved','scheduled')`;
  await enqueue("render_video", { videoId: v.id, quality: "draft" });
  return json({ ok: true, scene: sb.scenes[idx] });
});
