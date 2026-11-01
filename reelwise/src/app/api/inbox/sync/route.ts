import { route, json } from "@/lib/http";
import { enqueue } from "@/lib/jobs";
export const POST = route({ min: "editor", limit: [5, 60_000] }, async () => {
  await enqueue("sync_inbox", {}, new Date(), 1);
  return json({ ok: true });
});
