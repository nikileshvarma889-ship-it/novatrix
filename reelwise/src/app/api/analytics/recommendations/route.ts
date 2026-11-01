import { route, json, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { generate } from "@/lib/ai/claude";
import { RecommendationsSchema } from "@/lib/ai/schemas";

export const POST = route({ min: "editor", limit: [10, 60_000] }, async ({ user }) => {
  const snaps = await sql`select a.platform, a.name, s.day, s.metrics from analytics_snapshots s join social_accounts a on a.id = s.social_account_id
                          where s.workspace_id = ${user.workspaceId} and s.day > now() - interval '30 days' order by s.day`;
  const posts = await sql`select p.platform, v.title, p.published_at, m.metrics from publications p join videos v on v.id = p.video_id
                          left join post_metrics m on m.publication_id = p.id where p.workspace_id = ${user.workspaceId} and p.status = 'published' limit 40`;
  if (!snaps.length && !posts.length) throw new HttpError(409, "There is no analytics data yet. Connect accounts and sync analytics first.");
  const out = await generate(user.workspaceId, {
    system: "You are a social media analyst. Base every recommendation strictly on the data provided; if the data is thin, say so. Never invent numbers.",
    schema: RecommendationsSchema,
    effort: "medium",
    prompt: `Account metrics (as returned by the platforms):\n${JSON.stringify(snaps).slice(0, 60000)}\n\nPublished posts:\n${JSON.stringify(posts).slice(0, 30000)}\n\nGive 3-6 specific, actionable content recommendations.`,
  });
  return json(out);
});
