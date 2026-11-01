import { route, json } from "@/lib/http";
import { sql } from "@/lib/db";
import { brandBrief, generate } from "@/lib/ai/claude";
import { REPLY_SYSTEM } from "@/lib/ai/prompts";
import { ReplySchema } from "@/lib/ai/schemas";
import { findItem } from "../../find";

/** Draft only — nothing is sent from here. */
export const POST = route<{ id: string }>({ min: "editor", limit: [30, 60_000] }, async ({ user, params }) => {
  const item = await findItem(user.workspaceId, params.id);
  const [brand] = await sql`select * from brands where workspace_id = ${user.workspaceId} order by created_at limit 1`;
  const out = await generate(user.workspaceId, {
    system: REPLY_SYSTEM,
    schema: ReplySchema,
    effort: "low",
    prompt: `${brandBrief(brand ?? null)}\n\nPlatform: ${item.platform}\nPost: ${item.context_title ?? "(unknown)"}\nComment from ${item.author}: "${item.text}"\n\nDraft a reply.`,
  });
  await sql`update inbox_items set suggested_reply = ${out.reply} where id = ${item.id}`;
  return json(out);
});
