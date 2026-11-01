import { z } from "zod/v4";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #5b6cff");
export const BrandSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(2000).default(""),
  audience: z.string().max(1000).default(""),
  language: z.string().trim().min(1).max(40).default("English"),
  video_style: z.enum(["auto", "cinematic3d", "promo"]).default("auto"),
  colors: z.array(hex).min(2).max(3),
  fonts: z.object({ heading: z.string().max(60), body: z.string().max(60) }),
  characters: z.string().max(1000).default(""),
  intro_text: z.string().max(120).default(""),
  outro_text: z.string().max(120).default(""),
  contact: z.string().max(200).default(""),
  website: z.string().max(200).default(""),
  cta: z.string().max(120).default(""),
  duration_sec: z.number().int().min(5).max(180),
  aspect_ratio: z.enum(["9:16", "16:9", "1:1"]),
  music_pref: z.string().max(300).default(""),
  voice_pref: z.string().max(300).default(""),
  restrictions: z.string().max(2000).default(""),
  logo_media_id: z.uuid().nullable().default(null),
  music_media_id: z.uuid().nullable().default(null),
});
