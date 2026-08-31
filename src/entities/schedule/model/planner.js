import { findConflicts, getAllEvents, toMinutes } from "./calendar.js";

export const WORKSPACE_SCHEMA = 2;
export const CATALOG_SCHEMA = 1;
export const clone = (value) => structuredClone(value);
const colors = new Set([
  "violet",
  "rose",
  "blue",
  "amber",
  "cyan",
  "green",
  "indigo",
  "orange",
  "teal",
  "slate",
]);
const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};
const string = (value, max = 500) =>
  typeof value === "string" && value.length <= max;

export function validateSchedule(data) {
  ensure(
    data?.meta &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.meta.startDate) &&
      Number.isInteger(data.meta.weekCount) &&
      data.meta.weekCount >= 1 &&
      data.meta.weekCount <= 26,
    "У расписания неверная дата начала или количество учебных недель.",
  );
  ensure(
    Array.isArray(data.meta.sources) &&
      data.meta.sources.length <= 30 &&
      data.meta.sources.every(
        (s) =>
          string(s.label) && string(s.url, 2000) && /^https?:\/\//.test(s.url),
      ),
    "Некорректный список источников.",
  );
  ensure(
    Array.isArray(data.courses) && data.courses.length <= 60,
    "Некорректный список предметов.",
  );
  ensure(
    Array.isArray(data.slots) && data.slots.length <= 1500,
    "Некорректный список занятий (максимум 1500).",
  );
  const courses = new Set();
  for (const c of data.courses) {
    ensure(
      string(c.id, 100) && /^[\w.-]+$/.test(c.id) && !courses.has(c.id),
      "ID предмета должен быть уникальным.",
    );
    ensure(
      ["name", "shortName", "stream", "teachers"].every(
        (k) => string(c[k]) && c[k].trim(),
      ) && colors.has(c.color),
      "У предмета отсутствует название, поток или оформление.",
    );
    courses.add(c.id);
  }
  const ids = new Set();
  for (const s of data.slots) {
    ensure(
      string(s.id, 200) && s.id && !ids.has(s.id) && courses.has(s.courseId),
      "У занятия неверный предмет или повторяется ID.",
    );
    ids.add(s.id);
    ensure(
      ["lecture", "practice", "lab"].includes(s.kind) &&
        Number.isInteger(s.day) &&
        s.day >= 0 &&
        s.day <= 6,
      "Неверный тип занятия или день недели.",
    );
    ensure(
      [s.start, s.end].every(
        (t) => typeof t === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(t),
      ) && toMinutes(s.start) < toMinutes(s.end),
      "Время окончания должно быть позже начала в тот же день.",
    );
    ensure(
      Array.isArray(s.weeks) &&
        s.weeks.length > 0 &&
        s.weeks.length <= data.meta.weekCount &&
        new Set(s.weeks).size === s.weeks.length &&
        s.weeks.every(
          (w) => Number.isInteger(w) && w >= 1 && w <= data.meta.weekCount,
        ),
      `Укажи уникальные номера учебных недель от 1 до ${data.meta.weekCount}.`,
    );
    ensure(
      ["teacher", "room", "note", "stream"].every((k) => string(s[k], 2000)) &&
        ["campus", "video", "zoom"].includes(s.format),
      "У занятия неверно заполнены преподаватель, аудитория или формат.",
    );
  }
  ensure(
    getAllEvents(data).length <= 4000,
    "Слишком много занятий для одного семестра.",
  );
  return data;
}

export function validateCatalog(catalog, meta) {
  ensure(
    catalog?.schema === CATALOG_SCHEMA &&
      Array.isArray(catalog.entries) &&
      catalog.entries.length <= 500,
    "Ожидается каталог потоков формата «семестр.», версия 1.",
  );
  const ids = new Set();
  for (const entry of catalog.entries) {
    ensure(
      string(entry.id, 200) && entry.id && !ids.has(entry.id),
      "Повторяющийся ID потока в каталоге.",
    );
    ids.add(entry.id);
    ensure(
      string(entry.source, 2000) && string(entry.updatedAt, 100),
      "У потока отсутствует источник или дата.",
    );
    validateSchedule({ meta, courses: [entry.course], slots: entry.slots });
    ensure(
      entry.slots.length > 0,
      "Поток без занятий нельзя добавить в каталог.",
    );
  }
  return catalog;
}

export function seedWorkspace(schedule, catalog) {
  validateSchedule(schedule);
  validateCatalog(catalog, schedule.meta);
  return {
    schema: WORKSPACE_SCHEMA,
    status: "ready",
    profile: profileFromSchedule(schedule),
    publishedSelection: selectionFromSchedule(schedule, catalog),
    draftSelection: selectionFromSchedule(schedule, catalog),
    publishedSnapshot: clone(schedule),
    draftSnapshot: clone(schedule),
    previousSnapshot: null,
    catalogOverrides: emptyCatalog(catalog.updatedAt),
    catalogVersion: String(catalog.updatedAt || "bundled"),
    catalogSource: { type: "legacy-bundled", status: "ready" },
    updatedAt: new Date().toISOString(),
    publishedAt: null,
  };
}

export function createOnboardingWorkspace(catalog) {
  return {
    schema: WORKSPACE_SCHEMA,
    status: "onboarding",
    profile: null,
    publishedSelection: {},
    draftSelection: {},
    publishedSnapshot: null,
    draftSnapshot: null,
    previousSnapshot: null,
    catalogOverrides: emptyCatalog(catalog.updatedAt),
    catalogVersion: String(catalog.updatedAt || "bundled"),
    catalogSource: { type: "itmo-public", status: "idle" },
    updatedAt: new Date().toISOString(),
    publishedAt: null,
  };
}

export function validateWorkspace(state) {
  if (state?.schema === 1) return validateLegacyWorkspace(state);
  ensure(
    state?.schema === WORKSPACE_SCHEMA,
    "Неизвестная версия резервной копии.",
  );
  const status = state.status || "ready";
  ensure(
    ["onboarding", "ready"].includes(status),
    "Неизвестное состояние профиля.",
  );
  if (status === "onboarding") {
    ensure(state.profile === null, "Незавершённый профиль должен быть пустым.");
    validateSelection(state.publishedSelection);
    validateSelection(state.draftSelection);
    ensure(
      state.publishedSnapshot === null && state.draftSnapshot === null,
      "До завершения настройки расписание должно быть пустым.",
    );
    validateCatalog(state.catalogOverrides, {
      startDate: "2000-01-03",
      weekCount: 17,
      sources: [],
    });
    ensure(string(state.catalogVersion, 200), "Не указана версия каталога.");
    validateCatalogSource(state.catalogSource);
    return state;
  }
  validateProfile(state.profile);
  validateSelection(state.publishedSelection);
  validateSelection(state.draftSelection);
  validateSchedule(state.publishedSnapshot);
  validateSchedule(state.draftSnapshot);
  validateCatalog(state.catalogOverrides, state.publishedSnapshot.meta);
  ensure(string(state.catalogVersion, 200), "Не указана версия каталога.");
  validateCatalogSource(state.catalogSource);
  if (state.previousSnapshot) validateSchedule(state.previousSnapshot);
  return state;
}

function validateCatalogSource(source) {
  if (source == null) return;
  ensure(
    ["legacy-bundled", "itmo-public", "manual"].includes(source.type) &&
      [
        "idle",
        "loading",
        "ready",
        "available",
        "not-published",
        "error",
      ].includes(source.status) &&
      ["checkedAt", "sourceUrl", "message"].every(
        (key) => source[key] == null || string(source[key], 2000),
      ),
    "Некорректно описан источник каталога.",
  );
}

function emptyCatalog(updatedAt = "") {
  return { schema: CATALOG_SCHEMA, updatedAt, entries: [] };
}

export function profileFromSchedule(schedule) {
  const { meta } = schedule;
  return {
    group: meta.group || "",
    faculty: meta.faculty || "",
    program: meta.program || "",
    academicYear: meta.year || "",
    semester: meta.semester,
  };
}

export function validateProfile(profile) {
  ensure(
    profile &&
      ["group", "faculty", "program", "academicYear"].every(
        (key) => string(profile[key], 300) && profile[key].trim(),
      ) &&
      /^[A-ZА-ЯЁ0-9-]{2,20}$/i.test(profile.group) &&
      Number.isInteger(profile.semester) &&
      profile.semester >= 1 &&
      profile.semester <= 20,
    "Профиль пользователя заполнен некорректно.",
  );
  return profile;
}

export function validateSelection(selection) {
  ensure(
    selection &&
      !Array.isArray(selection) &&
      Object.entries(selection).every(
        ([courseId, entryId]) =>
          /^[\w.-]+$/.test(courseId) && string(entryId, 300) && entryId,
      ),
    "Выбор потоков заполнен некорректно.",
  );
  return selection;
}

export function selectionFromSchedule(schedule, catalog) {
  return Object.fromEntries(
    schedule.courses.map((course) => {
      const entry = matchingEntry(schedule, catalog.entries, course.id);
      return [course.id, entry?.id || `snapshot:${course.id}`];
    }),
  );
}

function validateLegacyWorkspace(state) {
  validateSchedule(state.published);
  validateSchedule(state.draft);
  validateCatalog(state.catalog, state.published.meta);
  if (state.previous) validateSchedule(state.previous);
  return state;
}

function catalogOverrides(legacyCatalog, sharedCatalog) {
  const shared = new Map(
    sharedCatalog.entries.map((entry) => [entry.id, entry]),
  );
  return {
    schema: CATALOG_SCHEMA,
    updatedAt: legacyCatalog.updatedAt,
    entries: legacyCatalog.entries
      .filter(
        (entry) =>
          JSON.stringify(shared.get(entry.id)) !== JSON.stringify(entry),
      )
      .map(clone),
  };
}

export function migrateWorkspace(state, baseSchedule, sharedCatalog) {
  if (!state) return seedWorkspace(baseSchedule, sharedCatalog);
  if (state.schema === WORKSPACE_SCHEMA) {
    validateWorkspace(state);
    return {
      ...state,
      status: state.status || "ready",
      catalogSource: state.catalogSource || {
        type: "legacy-bundled",
        status: "ready",
      },
    };
  }
  validateLegacyWorkspace(state);
  const overrides = catalogOverrides(state.catalog, sharedCatalog);
  const effective = mergeCatalog(
    sharedCatalog,
    overrides,
    state.published.meta,
  );
  return validateWorkspace({
    schema: WORKSPACE_SCHEMA,
    status: "ready",
    profile: profileFromSchedule(state.published),
    publishedSelection: selectionFromSchedule(state.published, effective),
    draftSelection: selectionFromSchedule(state.draft, effective),
    publishedSnapshot: clone(state.published),
    draftSnapshot: clone(state.draft),
    previousSnapshot: state.previous ? clone(state.previous) : null,
    catalogOverrides: overrides,
    catalogVersion: String(sharedCatalog.updatedAt || "bundled"),
    catalogSource: { type: "legacy-bundled", status: "ready" },
    updatedAt: state.updatedAt || new Date().toISOString(),
    updatedLocally: state.updatedLocally,
    publishedAt: state.publishedAt || null,
  });
}

export function initializeWorkspaceProfile(state, profile, templateSchedule) {
  validateWorkspace(state);
  ensure((state.status || "ready") === "onboarding", "Профиль уже настроен.");
  validateProfile(profile);
  const semesterPeriod = semesterDates(
    profile.academicYear,
    profile.semester,
    templateSchedule.meta.weekCount,
  );
  const snapshot = {
    meta: {
      ...clone(templateSchedule.meta),
      ...semesterPeriod,
      group: profile.group,
      faculty: profile.faculty,
      program: profile.program,
      year: profile.academicYear,
      semester: profile.semester,
      mode: "Личное расписание",
      description:
        "Расписание собрано пользователем из доступного каталога потоков.",
    },
    courses: curriculumCourses(profile.curriculum?.courses || []),
    slots: [],
  };
  validateSchedule(snapshot);
  return validateWorkspace({
    ...state,
    status: "ready",
    profile: clone(profile),
    publishedSnapshot: clone(snapshot),
    draftSnapshot: clone(snapshot),
    previousSnapshot: null,
    publishedSelection: {},
    draftSelection: {},
    updatedAt: new Date().toISOString(),
    publishedAt: null,
  });
}

function semesterDates(academicYear, semester, weekCount) {
  const startYear = Number(String(academicYear).match(/20\d{2}/)?.[0]);
  if (!startYear) return {};
  const isAutumn = Number(semester) % 2 === 1;
  const firstDay = new Date(
    Date.UTC(isAutumn ? startYear : startYear + 1, isAutumn ? 8 : 1, 1),
  );
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  firstDay.setUTCDate(firstDay.getUTCDate() - mondayOffset);
  const lastDay = new Date(firstDay);
  lastDay.setUTCDate(lastDay.getUTCDate() + weekCount * 7 - 1);
  const iso = (date) => date.toISOString().slice(0, 10);
  return { startDate: iso(firstDay), endDate: iso(lastDay) };
}

function curriculumCourses(courses) {
  const palette = [
    "violet",
    "rose",
    "blue",
    "amber",
    "cyan",
    "green",
    "indigo",
    "orange",
    "teal",
    "slate",
  ];
  return courses.map((course, index) => ({
    id: `isu-${course.disciplineId}`,
    name: course.name,
    shortName: course.name,
    stream: "не выбран",
    teachers: "Не указан",
    color: palette[index % palette.length],
  }));
}

export function effectiveCatalog(sharedCatalog, overrides, meta, source) {
  const base =
    source?.type === "legacy-bundled"
      ? sharedCatalog
      : emptyCatalog(overrides?.updatedAt || "live");
  return mergeCatalog(base, overrides, meta);
}

export function sameWorkspaceContent(a, b) {
  if (!a || !b) return false;
  const content = (state) => ({
    status: state.status || "ready",
    profile: state.profile,
    publishedSelection: state.publishedSelection,
    draftSelection: state.draftSelection,
    publishedSnapshot: state.publishedSnapshot,
    draftSnapshot: state.draftSnapshot,
    previousSnapshot: state.previousSnapshot,
    catalogOverrides: state.catalogOverrides,
    catalogVersion: state.catalogVersion,
    catalogSource: state.catalogSource,
    publishedAt: state.publishedAt,
  });
  return JSON.stringify(content(a)) === JSON.stringify(content(b));
}

export function selectEntry(schedule, entry) {
  const next = clone(schedule);
  const index = next.courses.findIndex((c) => c.id === entry.course.id);
  if (index >= 0) next.courses[index] = clone(entry.course);
  else next.courses.push(clone(entry.course));
  next.slots = next.slots
    .filter((s) => s.courseId !== entry.course.id)
    .concat(clone(entry.slots));
  return validateSchedule(next);
}

export function removeCourse(schedule, courseId) {
  return {
    ...clone(schedule),
    courses: schedule.courses.filter((c) => c.id !== courseId),
    slots: schedule.slots.filter((s) => s.courseId !== courseId),
  };
}

export function selectDraftEntry(state, entry) {
  return {
    ...state,
    draftSnapshot: selectEntry(state.draftSnapshot, entry),
    draftSelection: {
      ...state.draftSelection,
      [entry.course.id]: entry.id,
    },
  };
}

export function removeDraftCourse(state, courseId) {
  const draftSelection = { ...state.draftSelection };
  delete draftSelection[courseId];
  return {
    ...state,
    draftSnapshot: removeCourse(state.draftSnapshot, courseId),
    draftSelection,
  };
}

export function stageSnapshot(state, snapshot, catalog) {
  return {
    ...state,
    draftSnapshot: clone(snapshot),
    draftSelection: selectionFromSchedule(snapshot, catalog),
  };
}

// Compare actual lessons, not catalogue versions: an updated catalogue never changes a saved snapshot.
const courseSignature = (data, id) =>
  JSON.stringify({
    course: data.courses.find((c) => c.id === id),
    slots: data.slots
      .filter((s) => s.courseId === id)
      .map(({ id, ...s }) => s)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  });
export function changedCourses(a, b) {
  return [...new Set([...a.courses, ...b.courses].map((c) => c.id))].filter(
    (id) => courseSignature(a, id) !== courseSignature(b, id),
  );
}
export function matchingEntry(schedule, entries, courseId) {
  return entries.find(
    (e) =>
      e.course.id === courseId &&
      courseSignature(schedule, courseId) ===
        courseSignature({ courses: [e.course], slots: e.slots }, courseId),
  );
}
export function publishDraft(state) {
  validateWorkspace(state);
  validateSchedule(state.draftSnapshot);
  ensure(
    findConflicts(getAllEvents(state.draftSnapshot)).length === 0,
    "Сначала устрани пересечения в черновике.",
  );
  return {
    ...state,
    previousSnapshot: clone(state.publishedSnapshot),
    publishedSnapshot: clone(state.draftSnapshot),
    publishedSelection: clone(state.draftSelection),
    publishedAt: new Date().toISOString(),
  };
}
export function mergeCatalog(current, incoming, meta) {
  validateCatalog(incoming, meta);
  const merged = new Map(current.entries.map((e) => [e.id, e]));
  for (const entry of incoming.entries) merged.set(entry.id, clone(entry));
  return validateCatalog(
    {
      schema: CATALOG_SCHEMA,
      updatedAt: incoming.updatedAt,
      entries: [...merged.values()],
    },
    meta,
  );
}
export function parseWeeks(text) {
  const result = new Set();
  for (const part of text.split(/[,;\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:[-–](\d+))?$/);
    ensure(m, "Недели: например 1-16 или 1,3,5,7.");
    const first = Number(m[1]),
      last = Number(m[2] || m[1]);
    ensure(
      first >= 1 && last <= 17 && first <= last,
      "Номера недель должны быть от 1 до 17.",
    );
    for (let n = first; n <= last; n++) result.add(n);
  }
  ensure(result.size, "Укажи хотя бы одну неделю.");
  return [...result].sort((a, b) => a - b);
}
export function exportJson(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
