// End-to-end engine check without AI: seeds a storyboard and renders it.
import { sql } from "../src/lib/db";
import { renderJob } from "../worker/tasks";

async function main() {
  const [u] = await sql`insert into users (email, name, password_hash) values (${`smoke-${Date.now()}@example.com`}, 'Smoke', 'x') returning id`;
  const [w] = await sql`insert into workspaces (name) values ('Smoke test') returning id`;
  await sql`insert into memberships (workspace_id, user_id, role) values (${w.id}, ${u.id}, 'owner')`;
  const [b] = await sql`insert into brands (workspace_id, name, colors, cta, website, intro_text, outro_text)
    values (${w.id}, 'SwiftShip Couriers', ${sql.json(["#ff7a1a", "#2b59ff", "#0f172a"] as never)}, 'Book a pickup today', 'swiftship.example', 'SwiftShip Couriers', 'Anywhere. On time.') returning id`;
  const storyboard = {
    title: "From India to your door",
    style: "cinematic3d",
    hook: "Your parcel's journey",
    musicMood: "inspiring",
    caption: "Smoke test",
    hashtags: ["courier"],
    youtubeTitle: "Smoke test",
    youtubeDescription: "",
    thumbnailText: "India to USA",
    scenes: [
      { id: "s1", kind: "street_walk", durationSec: 4, heading: "Picked up in Mumbai", subheading: "Same-day collection", bullets: [], voiceover: "Our courier collects your parcel right from your doorstep in Mumbai.", camera: "tracking", imageMediaId: null, fromPlace: "", toPlace: "", characterColor: "#ff7a1a", mood: "warm" },
      { id: "s2", kind: "globe_route", durationSec: 4, heading: "Across the world", subheading: "", bullets: [], voiceover: "It flies across the globe to the United States.", camera: "push_in", imageMediaId: null, fromPlace: "Mumbai", toPlace: "New York", characterColor: "", mood: "night" },
      { id: "s3", kind: "handover", durationSec: 5, heading: "Delivered in New York", subheading: "", bullets: [], voiceover: "And arrives safely, handed to your customer with a smile.", camera: "static", imageMediaId: null, fromPlace: "", toPlace: "", characterColor: "#ff7a1a", mood: "bright" },
      { id: "s4", kind: "cta", durationSec: 3, heading: "Ship worldwide today", subheading: "Book a pickup", bullets: [], voiceover: "Ship worldwide with SwiftShip.", camera: "static", imageMediaId: null, fromPlace: "", toPlace: "", characterColor: "", mood: "bright" },
    ],
  };
  const [v] = await sql`insert into videos (workspace_id, brand_id, title, instruction, style, aspect_ratio, duration_sec, storyboard, status)
    values (${w.id}, ${b.id}, ${storyboard.title}, 'smoke', 'cinematic3d', ${process.argv[2] ?? "9:16"}, 16, ${sql.json(storyboard as never)}, 'rendering') returning id`;
  const t0 = Date.now();
  await renderJob({ videoId: v.id, quality: "draft" });
  const [r] = await sql`select v.status, v.error, m.path, t.path as thumb from videos v left join media m on m.id = v.video_media_id left join media t on t.id = v.thumbnail_media_id where v.id = ${v.id}`;
  console.log(JSON.stringify({ ...r, seconds: Math.round((Date.now() - t0) / 1000) }));
  await sql.end();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
