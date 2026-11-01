// Runs the real publish-kit job (frame extraction, database writes, cover render) with Claude's reply stubbed,
// because the test environment has no Claude API key. Uses the most recent rendered video (run tests/e2e.mjs first).
import { afterAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";

const seen: { images: number; prompt: string }[] = [];
vi.mock("../../src/lib/ai/claude", async (orig) => {
  const real = await orig<typeof import("../../src/lib/ai/claude")>();
  return {
    ...real,
    generate: vi.fn(async (_ws: string, opts: { prompt: string; images?: unknown[] }) => {
      seen.push({ images: opts.images?.length ?? 0, prompt: opts.prompt });
      return {
        youtubeTitle: "Ship from India to the USA in days",
        youtubeDescription: "We pick up from your door and deliver worldwide.\n\nBook a pickup today.",
        instagramCaption: "From your door to the USA 🇺🇸\nBook a pickup today.",
        hashtags: [{ tag: "#shipping", reach: "broad" }, { tag: "courier service", reach: "niche" }, { tag: "Shipping", reach: "broad" }, { tag: "SwiftShip", reach: "brand" }],
        chapterTitles: ["Pickup", "Book"],
        cover: { sceneIndex: 7, headline: "Ship worldwide", highlightWord: "worldwide", subline: "From your door", layout: "center", accentColor: "not-a-colour" },
        notes: "Lead with convenience.",
      };
    }),
  };
});

const { sql } = await import("../../src/lib/db");
const { publishKitJob, buildChapters } = await import("../../worker/tasks");

describe("publish kit", () => {
  afterAll(async () => { await sql.end(); });

  it("writes the kit from the real video and renders the cover", async () => {
    const [v] = await sql`select id, thumbnail_media_id from videos where video_media_id is not null and timeline is not null order by created_at desc limit 1`;
    expect(v, "run tests/e2e.mjs first to render a video").toBeTruthy();
    await publishKitJob({ videoId: v.id });

    expect(seen[0].images).toBe(2); // one frame per scene, from the rendered MP4
    expect(seen[0].prompt).toContain("Scene 0");
    const [after] = await sql`select * from videos where id = ${v.id}`;
    expect(after.publish_kit.status).toBe("ready");
    expect(after.youtube_title).toBe("Ship from India to the USA in days");
    expect(after.caption).toContain("Book a pickup");
    expect(after.hashtags).toEqual(["shipping", "courierservice", "SwiftShip"]); // # stripped, spaces removed, duplicates dropped
    expect(after.publish_kit.cover.sceneIndex).toBe(1); // clamped to the last scene
    expect(after.publish_kit.cover.accentColor).toMatch(/^#[0-9a-f]{6}$/i); // invalid colour replaced by brand colour
    expect(after.thumbnail_text).toBe("Ship worldwide");
    expect(after.thumbnail_media_id).not.toBe(v.thumbnail_media_id);
    const [m] = await sql`select path, mime, width, height from media where id = ${after.thumbnail_media_id}`;
    expect(m.mime).toBe("image/jpeg");
    expect([m.width, m.height]).toEqual([1080, 1920]);
    const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "csv=p=0", `${process.env.STORAGE_DIR}/${m.path}`], { encoding: "utf8" });
    expect(probe).toMatch(/mjpeg,1080,1920/);
    console.log("cover:", `${process.env.STORAGE_DIR}/${m.path}`);
  });

  it("builds YouTube chapters only when they are valid", () => {
    const t = { introSec: 0, sceneStarts: [0, 12, 25, 40], sceneDurations: [12, 13, 15, 12], totalSec: 55 };
    expect(buildChapters(t, ["Intro", "Pickup", "Flight", "Delivery"]).map((c) => c.at)).toEqual([0, 12, 25, 40]);
    expect(buildChapters({ ...t, sceneStarts: [0, 3, 6], sceneDurations: [3, 3, 3], totalSec: 10 }, ["a", "b", "c"])).toEqual([]);
  });
});
