import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getAllEvents,
  getWeekEvents,
  weekDate,
  findConflicts,
  getMetrics,
  makeIcs,
  foldIcsLine,
  locationLabel,
  layoutEvents,
} from "../src/entities/schedule/model/index.js";

const data = JSON.parse(
  readFileSync(
    new URL(
      "../src/entities/schedule/model/data/schedule.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const all = getAllEvents(data);

test("calendar separates overlapping cards into lanes, including chained and triple overlaps", () => {
  const event = (id, start, end, date = "2026-09-02") => ({
    occurrenceId: id,
    start,
    end,
    date,
  });
  const events = [
    event("a", "09:00", "10:00"),
    event("b", "09:30", "10:30"),
    event("c", "10:00", "11:00"),
    event("d", "11:00", "12:00"),
    event("e", "09:30", "09:40"),
    event("f", "09:30", "10:00", "2026-09-03"),
  ];
  const layout = layoutEvents(events);
  for (const [a, b] of findConflicts(events))
    assert.notEqual(
      layout.get(a.occurrenceId).lane,
      layout.get(b.occurrenceId).lane,
    );
  assert.equal(layout.get("a").lanes, 3);
  assert.equal(layout.get("c").lanes, 3);
  assert.equal(layout.get("a").lane, layout.get("c").lane);
  assert.equal(layout.get("d").lanes, 1);
  assert.equal(layout.get("d").conflicts.length, 0);
  assert.equal(layout.get("f").lanes, 1);
  assert.equal(layout.get("a").conflicts.length, 2);
  assert.deepEqual(layoutEvents([]), new Map());
});

test("all published dates expand into 252 unique, non-overlapping pairs", () => {
  assert.equal(all.length, 252);
  assert.equal(new Set(all.map((event) => event.occurrenceId)).size, 252);
  assert.deepEqual(findConflicts(all), []);
  assert.equal(getMetrics(all).academicHours, 504);
});

test("every lesson is 90 minutes, and all weeks and course references are valid", () => {
  for (const event of all) {
    assert.ok(event.course);
    assert.ok(event.week >= 1 && event.week <= 17);
    const minutes = (time) =>
      time.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
    assert.equal(minutes(event.end) - minutes(event.start), 90);
  }
});

test("first and last weeks are not replaced by generic parity schedules", () => {
  assert.equal(weekDate(data, 1), "2026-08-31");
  assert.equal(weekDate(data, 17, 1), "2026-12-22");
  assert.equal(
    getWeekEvents(data, 1).filter((event) => event.day < 2).length,
    0,
  );
  const last = getWeekEvents(data, 17);
  assert.equal(last.length, 4);
  assert.ok(last.every((event) => event.day === 1));
});

test("IBBD is Salikhov 1.4; irregular online Saturdays remain present", () => {
  const lessons = all.filter(
    (event) => event.courseId === "database" && event.kind === "practice",
  );
  assert.equal(lessons.length, 16);
  assert.ok(
    lessons.every(
      (event) =>
        event.stream === "ИББД_ТЗИ_N3 1.4" &&
        event.teacher === "Салихов Максим Русланович",
    ),
  );
  assert.equal(lessons.filter((event) => event.format === "video").length, 8);
  assert.equal(
    lessons.filter((event) => event.date === "2026-11-14").length,
    2,
  );
  assert.equal(lessons.filter((event) => event.end === "22:00").length, 6);
});

test("safety 3.2 exists only on the two published dates", () => {
  const safety = all.filter((event) => event.courseId === "safety");
  assert.equal(safety.length, 4);
  assert.deepEqual(
    [...new Set(safety.map((event) => event.date))],
    ["2026-09-26", "2026-10-24"],
  );
  assert.match(locationLabel(safety[0]), /430/);
});

test("English and PE are excluded; all ten selected subjects remain", () => {
  assert.equal(data.courses.length, 10);
  assert.ok(
    data.courses.every(
      (course) => !/English|Физическая культура/.test(course.name),
    ),
  );
  assert.equal(new Set(all.map((event) => event.courseId)).size, 10);
});

test("ICS uses Moscow dates, stable unique IDs, and valid UTF-8 line folding", () => {
  const ics = makeIcs(data);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 252);
  assert.ok(ics.includes("DTSTART:20260902T123000Z"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line, "utf8") <= 75);
  const input = "DESCRIPTION:" + "Русский текст ".repeat(30);
  assert.equal(foldIcsLine(input).replace(/\r\n /g, ""), input);
});
