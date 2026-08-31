import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchItmoGroupSchedule,
  parseItmoGroupSchedule,
} from "../server/itmoSchedule.js";

const lessonPage = `
  <table id="2day" class="rasp_tabl"><tbody><tr>
    <th class="day"><span>Вт</span></th>
    <td class="time"><span><div>17:10-18:40</div>2, 4, 6, 8</span></td>
    <td><span>Иванов Иван Иванович</span></td>
    <td class="room"><dl><dd>305 ауд.</dd><dt><span>Песочная наб., д.14</span></dt></dl></td>
    <td class="lesson"><dl><dd>Информационная безопасность баз данных (Прак)</dd></dl></td>
    <td class="lesson-format">Очно</td>
  </tr></tbody></table>`;

const options = {
  group: "N3347",
  sourceUrl: "https://itmo.ru/ru/schedule/0/N3347/schedule.htm",
  fetchedAt: "2026-08-31T10:00:00.000Z",
  curriculum: [
    {
      disciplineId: "35630",
      name: "Информационная безопасность баз данных",
    },
  ],
};

test("public ITMO schedule parser normalizes official HTML into catalog entries", () => {
  const result = parseItmoGroupSchedule(lessonPage, options);
  assert.equal(result.status, "available");
  assert.equal(result.catalog.entries.length, 1);
  const entry = result.catalog.entries[0];
  assert.equal(entry.id, "isu-35630:N3347");
  assert.equal(entry.course.stream, "N3347");
  assert.equal(entry.slots[0].kind, "practice");
  assert.equal(entry.slots[0].day, 1);
  assert.deepEqual(entry.slots[0].weeks, [2, 4, 6, 8]);
  assert.equal(entry.slots[0].room, "305 ауд., Песочная наб., д.14");
});

test("not-yet-published schedules are a valid empty source state", () => {
  const result = parseItmoGroupSchedule(
    "<article>Расписание не найдено</article>",
    options,
  );
  assert.equal(result.status, "not-published");
  assert.deepEqual(result.catalog.entries, []);
});

test("schedule loader uses the public group route without credentials", async () => {
  let requested = "";
  const result = await fetchItmoGroupSchedule(
    { group: "M9999", curriculum: [] },
    async (url) => {
      requested = String(url);
      return { ok: true, text: async () => lessonPage };
    },
  );
  assert.match(requested, /\/ru\/schedule\/0\/M9999\/schedule\.htm$/);
  assert.equal(result.status, "available");
});
