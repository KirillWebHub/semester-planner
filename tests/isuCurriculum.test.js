import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchIsuCurriculum,
  parsePlanCandidates,
  parseSemesterCourses,
} from "../server/isuCurriculum.js";

const directory = `
  <table><tr>
    <td>[763] ФБИТ</td>
    <td><a href="https:&#x2F;&#x2F;isu.ifmo.ru&#x2F;pls&#x2F;apex&#x2F;f?p=2143:13:1::NO::EP_UCHEB_PLAN:115144">10.03.01. - Информационная безопасность</a> Группы: N3345, N3347</td>
    <td>3</td><td>Бакалавр</td><td>Очная</td><td>115144</td><td>42677</td><td>Базовый</td><td>Профиль подготовки бакалавров</td>
  </tr><tr>
    <td>[763] ФБИТ</td><td><a href="x?EP_UCHEB_PLAN=2">10.03.01. - Информационная безопасность</a> Группы: N3347</td>
    <td>3</td><td>Бакалавр</td><td>Очная</td><td>177367</td><td>89589</td><td>Индивидуальный</td><td>Профиль</td>
  </tr></table>`;

const plan = `
  <tr><td colspan="25">4 семестр</td></tr>
  <tr><td>Старый модуль</td><td>Старый предмет</td><td>1</td><td></td><td>ФБИТ</td><td>16</td><td></td><td>16</td><td></td><td>20</td><td>Зачет</td><td>Да</td><td>Нет</td></tr>
  <tr><td colspan="25">5 семестр</td></tr>
  <tr><td>Профильный модуль</td><td>Информационная безопасность баз данных</td><td>35630</td><td></td><td>ФБИТ</td><td>16</td><td></td><td>32</td><td></td><td>60</td><td>Экзамен КР</td><td>Да</td><td>Нет</td></tr>
  <tr><td>Модуль по выбору</td><td>Web программирование</td><td>35646</td><td></td><td>ФБИТ</td><td>16</td><td>32</td><td></td><td></td><td>60</td><td>Д.Зачет</td><td>Да</td><td>Нет</td></tr>
  <tr><td colspan="25">6 семестр</td></tr>`;

test("public ISU parser keeps only normalized plan and curriculum data", () => {
  const candidates = parsePlanCandidates(directory, "N3347");
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[0], {
    faculty: "ФБИТ",
    program: "10.03.01. - Информационная безопасность",
    course: 3,
    qualification: "Бакалавр",
    studyMode: "Очная",
    planId: "115144",
    kind: "Базовый",
    url: "https://isu.ifmo.ru/pls/apex/f?p=2143:13:1::NO::EP_UCHEB_PLAN:115144",
  });
  const courses = parseSemesterCourses(plan, 5);
  assert.equal(courses.length, 2);
  assert.equal(courses[0].disciplineId, "35630");
  assert.deepEqual(courses[1].hours, {
    lectures: 16,
    labs: 32,
    practice: 0,
    selfStudy: 60,
  });
});

test("curriculum source requests ISU and selects the basic plan", async () => {
  const requests = [];
  const fetchMock = async (url) => {
    requests.push(String(url));
    return {
      ok: true,
      text: async () => (requests.length === 1 ? directory : plan),
    };
  };
  const result = await fetchIsuCurriculum(
    { academicYear: "2026 / 2027", group: "n3347", semester: 5 },
    fetchMock,
  );
  assert.equal(requests.length, 2);
  assert.match(requests[0], /EP_UCHEB_YEAR,EP_GROUP/);
  assert.equal(result.group, "N3347");
  assert.equal(result.planId, "115144");
  assert.equal(result.courses.length, 2);
  assert.ok(!JSON.stringify(result).includes("177367"));
});

test("curriculum source rejects arbitrary upstream parameters", async () => {
  await assert.rejects(
    fetchIsuCurriculum(
      { academicYear: "2026/2027", group: "../../secret", semester: 5 },
      async () => assert.fail("network must not be called"),
    ),
    /группы/,
  );
});
