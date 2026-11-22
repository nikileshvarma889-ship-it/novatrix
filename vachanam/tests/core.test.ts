import { test } from "node:test";
import assert from "node:assert/strict";
import { BOOKS, BOOK_BY_CODE } from "../src/data/books";
import { neighbour } from "../src/lib/nav";
import { makeRef, makeVid, parseRef } from "../src/lib/ref";

test("canon: 66 books, 39 OT + 27 NT, 1189 chapters, unique codes", () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(BOOKS.filter((b) => b.testament === "OT").length, 39);
  assert.equal(BOOKS.filter((b) => b.testament === "NT").length, 27);
  assert.equal(BOOKS.reduce((n, b) => n + b.chapters, 0), 1189);
  assert.equal(new Set(BOOKS.map((b) => b.code)).size, 66);
  assert.deepEqual([BOOK_BY_CODE.PSA.chapters, BOOK_BY_CODE.JHN.chapters, BOOK_BY_CODE.OBA.chapters], [150, 21, 1]);
});

test("chapter navigation crosses book boundaries and stops at both ends", () => {
  assert.deepEqual(neighbour("GEN", 50, 1), { book: "EXO", chapter: 1 });
  assert.deepEqual(neighbour("EXO", 1, -1), { book: "GEN", chapter: 50 });
  assert.deepEqual(neighbour("MAL", 4, 1), { book: "MAT", chapter: 1 });
  assert.deepEqual(neighbour("JHN", 3, 1), { book: "JHN", chapter: 4 });
  assert.equal(neighbour("GEN", 1, -1), null);
  assert.equal(neighbour("REV", 22, 1), null);
  assert.equal(neighbour("XXX", 1, 1), null);
});

test("stable verse references round-trip and sort in canonical order", () => {
  assert.equal(makeRef("JHN", 3, 16), "JHN.3.16");
  assert.deepEqual(parseRef("JHN.3.16"), { book: "JHN", chapter: 3, verse: 16 });
  assert.deepEqual(parseRef("1CO.13"), { book: "1CO", chapter: 13, verse: undefined });
  assert.equal(parseRef("John 3:16"), null);
  assert.equal(parseRef("ABC.1.1"), null);
  assert.ok(makeVid("GEN", 50, 26) < makeVid("EXO", 1, 1));
  assert.ok(makeVid("JHN", 3, 16) < makeVid("JHN", 3, 17));
  assert.equal(makeVid("JHN", 3, 16), 43_003_016);
});
