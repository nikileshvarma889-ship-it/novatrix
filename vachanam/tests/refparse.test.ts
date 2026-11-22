import { test } from "node:test";
import assert from "node:assert/strict";
import { splitRefs } from "../src/lib/refparse";

test("finds citations and keeps the surrounding text", () => {
  const s = splitRefs("Read (John 3:16) and Psalm 23:1-4, also 1 Corinthians 13.");
  const refs = s.filter((x) => x.kind === "ref") as any[];
  assert.deepEqual(refs.map((r) => [r.book, r.chapter, r.verse]), [["JHN", 3, 16], ["PSA", 23, 1], ["1CO", 13, undefined]]);
  assert.equal(s.map((x) => x.text).join(""), "Read (John 3:16) and Psalm 23:1-4, also 1 Corinthians 13.");
});
test("Telugu text around refs, aliases, and invalid chapters", () => {
  const s = splitRefs("దేవుడు లోకమును ప్రేమించెను (John 3:16). Song of Songs 2:4; John 99:1; Revelation 22");
  const refs = s.filter((x) => x.kind === "ref") as any[];
  assert.deepEqual(refs.map((r) => r.book + r.chapter), ["JHN3", "SNG2", "REV22"]);
});
