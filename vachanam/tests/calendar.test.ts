import { test } from "node:test";
import assert from "node:assert/strict";
import { easter, feasts, keyOf, monthGrid, nextFeast, feastIndex, MIN_YEAR, MAX_YEAR } from "../src/lib/calendar";

test("Easter dates 2025–2030 (published Western dates)", () => {
  const want: Record<number, string> = { 2025: "2025-04-20", 2026: "2026-04-05", 2027: "2027-03-28", 2028: "2028-04-16", 2029: "2029-04-01", 2030: "2030-04-21" };
  for (const [y, d] of Object.entries(want)) assert.equal(keyOf(easter(Number(y))), d);
});

test("moveable feasts follow Easter", () => {
  const f = Object.fromEntries(feasts(2026).map((x) => [x.en, x.key]));
  assert.equal(f["Ash Wednesday"], "2026-02-18");
  assert.equal(f["Palm Sunday"], "2026-03-29");
  assert.equal(f["Good Friday"], "2026-04-03");
  assert.equal(f["Ascension Day"], "2026-05-14");
  assert.equal(f["Pentecost"], "2026-05-24");
  assert.equal(f["First Sunday of Advent"], "2026-11-29");
  assert.equal(feasts(2025).find((x) => x.en === "First Sunday of Advent")!.key, "2025-11-30");
  assert.equal(feasts(2027).find((x) => x.en === "First Sunday of Advent")!.key, "2027-11-28");
});

test("month grids: weekday of the 1st and leap years", () => {
  const jan25 = monthGrid(2025, 0);
  assert.equal(jan25.indexOf(1), 3);                      // 1 Jan 2025 was a Wednesday
  assert.equal(Math.max(...(monthGrid(2028, 1).filter(Boolean) as number[])), 29);   // 2028 is a leap year
  assert.equal(Math.max(...(monthGrid(2030, 1).filter(Boolean) as number[])), 28);
  assert.equal(monthGrid(2030, 11).length % 7, 0);
});

test("feast index spans 2025–2030 and next feast counts days", () => {
  const idx = feastIndex();
  assert.ok(idx["2025-12-25"] && idx["2030-12-25"]);
  assert.equal(MIN_YEAR, 2025); assert.equal(MAX_YEAR, 2030);
  const n = nextFeast(new Date(2026, 10, 22))!;
  assert.equal(n.en, "Christmas"); assert.equal(n.days, 33);
  assert.equal(nextFeast(new Date(2031, 0, 1)), null);
});
