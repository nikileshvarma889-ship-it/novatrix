import { z } from "zod/v4";

export const CINEMATIC_KINDS = ["globe_route", "street_walk", "handover", "city_flyover", "product_podium"] as const;
export const PROMO_KINDS = ["title", "text_image", "bullets", "product", "stat", "quote", "cta"] as const;
export const CAMERA = ["push_in", "pull_out", "orbit", "crane", "tracking", "static"] as const;

export const SceneSchema = z.object({
  id: z.string().describe("short slug, unique in the video"),
  kind: z.enum([...CINEMATIC_KINDS, ...PROMO_KINDS]),
  durationSec: z.number().describe("2-12 seconds"),
  heading: z.string().describe("on-screen headline, max 7 words"),
  subheading: z.string().describe("supporting on-screen line, may be empty"),
  bullets: z.array(z.string()).describe("for bullets scenes, 2-4 short items; otherwise empty"),
  voiceover: z.string().describe("narration spoken during this scene; empty for none"),
  camera: z.enum(CAMERA),
  imageMediaId: z.string().nullable().describe("id of a provided brand/product image to feature, or null"),
  fromPlace: z.string().describe("for globe_route: origin city/country; else empty"),
  toPlace: z.string().describe("for globe_route: destination city/country; else empty"),
  characterColor: z.string().describe("hex shirt colour for the character in street_walk/handover, else empty"),
  mood: z.enum(["bright", "warm", "night", "dramatic", "calm"]),
});

export const StoryboardSchema = z.object({
  title: z.string(),
  style: z.enum(["cinematic3d", "promo"]),
  hook: z.string().describe("the first-second hook line"),
  musicMood: z.enum(["upbeat", "inspiring", "calm", "dramatic", "corporate"]),
  scenes: z.array(SceneSchema),
  caption: z.string().describe("Instagram/Facebook caption with line breaks and CTA, no hashtags"),
  hashtags: z.array(z.string()).describe("8-15 hashtags without the # sign"),
  youtubeTitle: z.string().describe("max 90 characters"),
  youtubeDescription: z.string(),
  thumbnailText: z.string().describe("2-5 punchy words"),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;
export type Scene = z.infer<typeof SceneSchema>;

export const CONTENT_KINDS = ["instagram_caption", "youtube_title", "video_description", "hashtags", "keywords", "video_script", "hooks", "calls_to_action", "thumbnail_text", "community_post_ideas"] as const;
export const TONES = ["professional", "funny", "educational", "promotional", "storytelling", "emotional"] as const;

export const ContentSchema = z.object({
  variants: z.array(z.object({ label: z.string(), text: z.string() })).describe("3-5 alternative outputs"),
  notes: z.string().describe("one line on how the brand guidelines shaped this, may be empty"),
});

export const ReplySchema = z.object({ reply: z.string(), needsHuman: z.boolean().describe("true if the comment is a complaint, legal, medical or sensitive") });
export const IdeasSchema = z.object({ ideas: z.array(z.object({ title: z.string(), instruction: z.string() })) });
export const RecommendationsSchema = z.object({ recommendations: z.array(z.object({ title: z.string(), detail: z.string() })) });
