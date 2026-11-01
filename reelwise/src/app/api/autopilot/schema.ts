import { z } from "zod/v4";
export const RuleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  brandId: z.uuid(),
  instruction: z.string().trim().min(10).max(3000),
  platforms: z.array(z.enum(["instagram", "facebook", "youtube"])).min(1),
  perWeek: z.number().int().min(1).max(21),
  publishTimes: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h, UTC)")).min(1).max(6),
  style: z.enum(["auto", "cinematic3d", "promo"]),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
});
