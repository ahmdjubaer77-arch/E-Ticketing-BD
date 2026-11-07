import test from "node:test";
import assert from "node:assert/strict";
import { createOverviewTrend, parseOverviewDays } from "./overview.js";

test("overview period accepts only supported day ranges", () => {
  assert.equal(parseOverviewDays(undefined), 30);
  assert.equal(parseOverviewDays("7"), 7);
  assert.equal(parseOverviewDays("30"), 30);
  assert.equal(parseOverviewDays("90"), 90);
  assert.equal(parseOverviewDays("14"), null);
  assert.equal(parseOverviewDays("7days"), null);
});

test("overview trend fills missing dates with zero in UTC order", () => {
  const start = new Date("2026-11-05T00:00:00.000Z");
  assert.deepEqual(createOverviewTrend(start, 3, [
    { _id: "2026-11-05", count: 2 },
    { _id: "2026-11-07", count: 1 },
  ]), [
    { date: "2026-11-05", count: 2 },
    { date: "2026-11-06", count: 0 },
    { date: "2026-11-07", count: 1 },
  ]);
});
