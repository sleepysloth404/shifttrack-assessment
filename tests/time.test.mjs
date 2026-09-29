import test from "node:test";
import assert from "node:assert/strict";
import {
  atLocalTime,
  duration,
  elapsedClock,
  localDate,
  weekDates,
  workedMinutes,
} from "../src/domain/time.ts";

test("week begins Monday, including a Sunday at a month boundary", () => {
  const days = weekDates(new Date(2026, 9, 4, 12));
  assert.equal(localDate(days[0]), "2026-09-28");
  assert.equal(localDate(days[6]), "2026-10-04");
});

test("time input rejects invalid hours and impossible dates", () => {
  assert.equal(atLocalTime("2026-09-28", "24:00"), null);
  assert.equal(atLocalTime("2026-02-30", "09:00"), null);
  assert.ok(atLocalTime("2026-09-28", "09:00") instanceof Date);
});

test("duration subtracts unpaid break and live clock derives from elapsed time", () => {
  const shift = {
    id: "s1",
    date: "2026-09-28",
    startTime: "2026-09-28T09:00:00Z",
    endTime: "2026-09-28T17:00:00Z",
    breakMinutes: 30,
  };
  assert.equal(duration(workedMinutes(shift)), "7h 30m");
  assert.equal(elapsedClock(3661000), "01:01:01");
});
