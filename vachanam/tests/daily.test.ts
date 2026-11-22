import { test } from "node:test";
import assert from "node:assert/strict";
import { planDaily, formatTime } from "../src/lib/dailyPlan";

test("first reminder is today if the time hasn't passed, otherwise tomorrow", () => {
  const before = planDaily(new Date(2026, 10, 22, 6, 30), 7, 0, 3);
  assert.equal(before[0].at.toString(), new Date(2026, 10, 22, 7, 0).toString());
  const after = planDaily(new Date(2026, 10, 22, 7, 5), 7, 0, 3);
  assert.equal(after[0].at.toString(), new Date(2026, 10, 23, 7, 0).toString());
});

test("30 consecutive days at the chosen time, each with a different verse", () => {
  const plan = planDaily(new Date(2026, 11, 20, 9, 0), 6, 45, 30);
  assert.equal(plan.length, 30);
  plan.forEach((p, i) => { assert.equal(p.at.getHours(), 6); assert.equal(p.at.getMinutes(), 45); if (i) assert.equal(Math.round((p.at.getTime() - plan[i - 1].at.getTime()) / 3_600_000), 24); });
  assert.equal(new Set(plan.map((p) => p.ref)).size, 30, "no verse repeats within the scheduled window");
  assert.equal(plan.at(-1)!.at.getFullYear(), 2027, "crosses the year boundary");
});

test("time formatting", () => {
  assert.deepEqual([formatTime(7, 0), formatTime(0, 5), formatTime(12, 30), formatTime(21, 45)], ["7:00 AM", "12:05 AM", "12:30 PM", "9:45 PM"]);
});
