import { test } from "node:test";
import assert from "node:assert/strict";
import { buildParams, handle, makeLimiter, MODEL, parseBody, SYSTEM_PROMPT } from "../supabase/functions/bible-guide/guide";

const cors = { "access-control-allow-origin": "*" };
function fakeClient(chunks: string[], stop = "end_turn", fail?: Error) {
  const calls: any[] = [];
  const client: any = { beta: { messages: { stream(params: any) {
    calls.push(params);
    return {
      async *[Symbol.asyncIterator]() {
        for (const text of chunks) yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } };
        if (fail) throw fail;
      },
      finalMessage: async () => ({ stop_reason: stop, content: [] }),
    };
  } } } };
  return { client, calls };
}
const post = (body: unknown, ip = "1.1.1.1") => new Request("http://x/bible-guide", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
const lines = async (r: Response) => (await r.text()).trim().split("\n").map((l) => JSON.parse(l));

test("parseBody validates untrusted input", () => {
  assert.ok("error" in parseBody(null));
  assert.ok("error" in parseBody({ messages: [] }));
  assert.ok("error" in parseBody({ messages: [{ role: "system", content: "x" }] }));
  assert.ok("error" in parseBody({ messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }), "last must be user");
  assert.ok("error" in parseBody({ messages: [{ role: "user", content: "x".repeat(4001) }] }));
  const ok = parseBody({ lang: "te", messages: [{ role: "assistant", content: "hi" }, { role: "user", content: "  What does John 3:16 mean?  " }] });
  assert.ok(!("error" in ok));
  if (!("error" in ok)) { assert.equal(ok.lang, "te"); assert.equal(ok.messages.length, 1, "leading assistant turn dropped"); assert.equal(ok.messages[0].content, "What does John 3:16 mean?"); }
  const unknownLang = parseBody({ lang: "fr", messages: [{ role: "user", content: "hi" }] });
  if (!("error" in unknownLang)) assert.equal(unknownLang.lang, "en");
});

test("history is capped and still starts with the user", () => {
  const many = Array.from({ length: 41 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  const r = parseBody({ messages: many });
  assert.ok(!("error" in r));
  if (!("error" in r)) { assert.ok(r.messages.length <= 24); assert.equal(r.messages[0].role, "user"); assert.equal(r.messages.at(-1)!.content, "m40"); }
});

test("request uses Opus 5.5, medium effort, cached system prompt, fallbacks, and a trailing language note", () => {
  const p: any = buildParams({ lang: "both", messages: [{ role: "user", content: "Who was Ruth?" }] });
  assert.equal(p.model, MODEL); assert.equal(MODEL, "claude-opus-5-5");
  assert.equal(p.output_config.effort, "medium");
  assert.equal(p.system, SYSTEM_PROMPT);
  assert.deepEqual(p.cache_control, { type: "ephemeral" });
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]); assert.equal(p.fallbacks, "default");
  assert.equal(p.thinking, undefined, "Opus 5.5 thinking is always on; don't send a thinking config");
  assert.equal(p.messages.at(-1).role, "system"); assert.match(p.messages.at(-1).content, /Telugu first/);
  assert.match(SYSTEM_PROMPT, /only|nothing else/i); assert.match(SYSTEM_PROMPT, /Never invent verses/);
});

test("streams answer deltas then done", async () => {
  const { client, calls } = fakeClient(["God so loved ", "the world (John 3:16)."]);
  const r = await handle(post({ messages: [{ role: "user", content: "What does John 3:16 mean?" }] }), { client, allow: () => true, cors });
  assert.equal(r.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
  const out = await lines(r);
  assert.deepEqual(out.map((o) => o.t), ["delta", "delta", "done"]);
  assert.equal(out.filter((o) => o.t === "delta").map((o) => o.text).join(""), "God so loved the world (John 3:16).");
  assert.equal(calls.length, 1);
});

test("refusal and upstream failures become friendly error lines", async () => {
  const refused = await lines(await handle(post({ messages: [{ role: "user", content: "x" }] }), { client: fakeClient([], "refusal").client, allow: () => true, cors }));
  assert.equal(refused.at(-1).code, "refusal");
  const failed = await lines(await handle(post({ messages: [{ role: "user", content: "x" }] }), { client: fakeClient(["partial"], "end_turn", new Error("boom")).client, allow: () => true, cors }));
  assert.equal(failed.at(-1).t, "error"); assert.equal(failed.at(-1).code, "server");
});

test("rejects bad requests before calling Claude", async () => {
  const { client, calls } = fakeClient(["x"]);
  assert.equal((await handle(new Request("http://x", { method: "GET" }), { client, allow: () => true, cors })).status, 405);
  assert.equal((await handle(post({ messages: [] }), { client, allow: () => true, cors })).status, 400);
  assert.equal((await handle(post({ messages: [{ role: "user", content: "hi" }] }), { client, allow: () => false, cors })).status, 429);
  assert.equal((await handle(new Request("http://x", { method: "OPTIONS" }), { client, allow: () => true, cors })).status, 204);
  assert.equal(calls.length, 0);
});

test("limiter allows N per window per key", () => {
  const allow = makeLimiter(2, 1000);
  assert.deepEqual([allow("a", 0), allow("a", 1), allow("a", 2), allow("b", 2), allow("a", 1500)], [true, true, false, true, true]);
});
