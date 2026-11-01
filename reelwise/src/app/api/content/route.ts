import { z } from "zod/v4";
import { route, json, body, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { brandBrief, generate } from "@/lib/ai/claude";
import { CONTENT_SYSTEM } from "@/lib/ai/prompts";
import { CONTENT_KINDS, ContentSchema, TONES } from "@/lib/ai/schemas";

const Req = z.object({
  kind: z.enum(CONTENT_KINDS),
  tone: z.enum(TONES),
  language: z.string().trim().min(2).max(40),
  brandId: z.uuid().nullable(),
  topic: z.string().trim().min(3).max(3000),
  platform: z.enum(["instagram", "facebook", "youtube", "any"]).default("any"),
});

export const GET = route({}, async ({ user }) =>
  json(await sql`select * from content_generations where workspace_id = ${user.workspaceId} order by created_at desc limit 50`),
);

export const POST = route({ min: "editor", limit: [30, 60_000] }, async ({ req, user }) => {
  const d = await body(req, Req);
  const brand = d.brandId ? (await sql`select * from brands where id = ${d.brandId} and workspace_id = ${user.workspaceId}`)[0] : null;
  if (d.brandId && !brand) throw new HttpError(404, "Brand not found.");
  const out = await generate(user.workspaceId, {
    system: CONTENT_SYSTEM,
    schema: ContentSchema,
    effort: "low",
    prompt: `${brandBrief(brand ?? null)}\n\nWrite: ${d.kind.replace(/_/g, " ")}\nPlatform: ${d.platform}\nTone: ${d.tone}\nLanguage: ${d.language}\nTopic / details:\n${d.topic}\n\nGive 3-5 distinct variants.`,
  });
  const [row] = await sql`insert into content_generations (workspace_id, brand_id, kind, tone, language, input, output, created_by)
    values (${user.workspaceId}, ${d.brandId}, ${d.kind}, ${d.tone}, ${d.language}, ${d.topic}, ${sql.json(out as never)}, ${user.id}) returning *`;
  return json(row, 201);
});
