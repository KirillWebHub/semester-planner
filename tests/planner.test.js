import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  changedCourses,
  clone,
  createOnboardingWorkspace,
  effectiveCatalog,
  initializeWorkspaceProfile,
  matchingEntry,
  mergeCatalog,
  migrateWorkspace,
  parseWeeks,
  publishDraft,
  seedWorkspace,
  sameWorkspaceContent,
  selectDraftEntry,
  selectEntry,
  validateCatalog,
  validateSchedule,
  validateWorkspace,
} from "../src/entities/schedule/model/index.js";
import {
  getAllEvents,
  findConflicts,
  makeIcs,
  shortTeacher,
} from "../src/entities/schedule/model/index.js";
import {
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  readBrowser,
  writeBrowser,
  TEST_STORAGE_KEY,
} from "../src/features/workspace/lib/browserStorage.js";
import { workspaceStore } from "../server/persistence.js";
const base = JSON.parse(
  readFileSync(
    new URL(
      "../src/entities/schedule/model/data/schedule.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const catalog = JSON.parse(
  readFileSync(
    new URL(
      "../src/entities/schedule/model/data/catalog.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const seed = () => seedWorkspace(base, catalog);
const english = {
  id: "english:test",
  origin: "manual",
  source: "Test fixture",
  updatedAt: "2026-08-28",
  course: {
    id: "english",
    name: "Английский язык",
    shortName: "Английский",
    stream: "TEST",
    teachers: "Тест",
    color: "violet",
  },
  slots: [
    {
      id: "english-test",
      courseId: "english",
      kind: "practice",
      day: 6,
      start: "08:10",
      end: "09:40",
      weeks: [1, 3, 17],
      teacher: "-",
      room: "3302, Ломоносова, 9",
      note: "-",
      stream: "TEST",
      format: "campus",
    },
  ],
};
test("seed is an exact independent snapshot of the existing 252 lessons", () => {
  const state = seed();
  validateWorkspace(state);
  assert.equal(state.schema, 2);
  assert.equal(state.status, "ready");
  assert.deepEqual(state.profile, {
    group: "N3347",
    faculty: "ФБИТ",
    program: "Технологии защиты информации",
    academicYear: "2026 / 2027",
    semester: 5,
  });
  assert.deepEqual(state.publishedSnapshot, base);
  assert.deepEqual(state.draftSnapshot, base);
  assert.equal(state.catalogOverrides.entries.length, 0);
  state.draftSnapshot.slots[0].weeks.push(17);
  assert.deepEqual(state.publishedSnapshot, base);
  assert.equal(getAllEvents(base).length, 252);
});
test("a new user starts without N3347 data and receives an empty personal schedule", () => {
  const onboarding = createOnboardingWorkspace(catalog);
  validateWorkspace(onboarding);
  assert.equal(onboarding.status, "onboarding");
  assert.equal(onboarding.profile, null);
  assert.equal(onboarding.publishedSnapshot, null);
  assert.equal(onboarding.draftSnapshot, null);

  const profile = {
    group: "N9999",
    faculty: "ФБИТ",
    program: "Технологии защиты информации",
    academicYear: "2026 / 2027",
    semester: 5,
  };
  const ready = initializeWorkspaceProfile(onboarding, profile, base);
  assert.equal(ready.status, "ready");
  assert.deepEqual(ready.profile, profile);
  assert.equal(ready.publishedSnapshot.meta.group, "N9999");
  assert.deepEqual(ready.publishedSnapshot.courses, []);
  assert.deepEqual(ready.publishedSnapshot.slots, []);
  assert.deepEqual(ready.publishedSelection, {});
  assert.equal(getAllEvents(ready.publishedSnapshot).length, 0);
});
test("all 54 catalog variants validate and include the same shared lectures per course", () => {
  validateCatalog(catalog, base.meta);
  assert.equal(catalog.entries.length, 54);
  for (const entry of catalog.entries) {
    assert.ok(entry.slots.length);
    assert.equal(
      getAllEvents({
        meta: base.meta,
        courses: [entry.course],
        slots: entry.slots,
      }).length,
      entry.course.id === "safety"
        ? 4
        : ["electronics", "networks", "programming", "crypto"].includes(
              entry.course.id,
            )
          ? 32
          : 24,
    );
  }
});
test("changing a stream changes only that subject in the draft; selecting it again deduplicates", () => {
  const state = seed(),
    target = catalog.entries.find((e) => e.id === "web:1.1");
  Object.assign(state, selectDraftEntry(state, target));
  assert.deepEqual(state.publishedSnapshot, base);
  assert.deepEqual(changedCourses(base, state.draftSnapshot), ["web"]);
  assert.equal(state.draftSelection.web, "web:1.1");
  assert.deepEqual(
    selectEntry(state.draftSnapshot, target),
    state.draftSnapshot,
  );
  assert.equal(
    matchingEntry(state.draftSnapshot, catalog.entries, "web").id,
    target.id,
  );
  assert.deepEqual(
    state.draftSnapshot.slots.filter((s) => s.courseId !== "web"),
    base.slots.filter((s) => s.courseId !== "web"),
  );
});
test("English exact weeks and Sunday survive publication; previous version remains", () => {
  const state = seed();
  Object.assign(state, selectDraftEntry(state, english));
  const next = publishDraft(state);
  assert.equal(getAllEvents(next.publishedSnapshot).length, 255);
  assert.deepEqual(next.previousSnapshot, base);
  assert.equal(next.publishedSelection.english, "english:test");
  const lessons = getAllEvents(next.publishedSnapshot).filter(
    (e) => e.courseId === "english",
  );
  assert.deepEqual(
    lessons.map((e) => e.date),
    ["2026-09-06", "2026-09-20", "2026-12-27"],
  );
  assert.match(makeIcs(next.publishedSnapshot), /DTSTART:20260906T051000Z/);
  assert.doesNotMatch(
    makeIcs(next.publishedSnapshot),
    /Английский и физкультура не включены/,
  );
  assert.equal(shortTeacher("-"), "Преподаватель не указан");
});
test("conflicting drafts are preserved but cannot replace the published schedule", () => {
  const state = seed(),
    entry = clone(english);
  Object.assign(entry.slots[0], {
    day: 2,
    start: "15:30",
    end: "17:00",
    weeks: [1, 3],
  });
  Object.assign(state, selectDraftEntry(state, entry));
  assert.equal(findConflicts(getAllEvents(state.draftSnapshot)).length, 2);
  assert.throws(() => publishDraft(state), /пересечения/);
  assert.deepEqual(state.publishedSnapshot, base);
});
test("catalog refresh never mutates saved snapshots or removes missing entries", () => {
  const state = seed(),
    entry = clone(catalog.entries[0]);
  entry.slots[0].room = "999, Новый корпус";
  const refreshed = mergeCatalog(
    catalog,
    { schema: 1, updatedAt: "2026-09-01", entries: [entry] },
    base.meta,
  );
  assert.equal(refreshed.entries.length, catalog.entries.length);
  assert.deepEqual(state.publishedSnapshot, base);
  assert.deepEqual(state.draftSnapshot, base);
  const next = selectEntry(state.draftSnapshot, refreshed.entries[0]);
  assert.deepEqual(changedCourses(state.draftSnapshot, next), ["web"]);
});
test("week ranges reject invalid, missing and out-of-semester values", () => {
  assert.deepEqual(parseWeeks("1-3, 3, 5; 17"), [1, 2, 3, 5, 17]);
  for (const text of ["", "0", "18", "8-4", "все", "1-99999"])
    assert.throws(() => parseWeeks(text));
});
test("import validation rejects broken references, duplicate IDs and invalid times", () => {
  for (const patch of [
    (s) => (s.start = "25:00"),
    (s) => (s.end = "00:00"),
    (s) => (s.courseId = "missing"),
    (s) => (s.weeks = [0]),
    (s) => (s.day = 7),
  ]) {
    const data = clone(base);
    patch(data.slots[0]);
    assert.throws(() => validateSchedule(data));
  }
  const duplicate = clone(base);
  duplicate.slots.push(clone(duplicate.slots[0]));
  assert.throws(() => validateSchedule(duplicate));
  const bad = clone(catalog);
  bad.entries.push(bad.entries[0]);
  assert.throws(() => validateCatalog(bad, base.meta));
  assert.throws(() => validateWorkspace({ ...seed(), schema: 3 }));
});
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
  };
}
test("browser storage restores draft and published data without re-seeding, with corrupt-copy recovery", () => {
  const storage = memoryStorage(),
    state = seed();
  Object.assign(state, selectDraftEntry(state, english));
  const record = { state, serverRevision: 4, pending: true };
  assert.equal(writeBrowser(storage, record), "");
  assert.deepEqual(readBrowser(storage, base, catalog).record, record);
  writeBrowser(storage, record);
  storage.setItem(STORAGE_KEY, "broken");
  const restored = readBrowser(storage, base, catalog);
  assert.deepEqual(restored.record, record);
  assert.match(restored.error, /резервная/);
  writeBrowser(storage, record);
  assert.deepEqual(
    JSON.parse(storage.getItem(STORAGE_KEY + ":backup")),
    record,
  );
});
test("legacy N3347 workspace migrates to v2 without changing the saved schedule", () => {
  const legacy = {
    schema: 1,
    published: clone(base),
    draft: clone(base),
    catalog: clone(catalog),
    previous: null,
    updatedAt: "2026-08-30T10:00:00.000Z",
    publishedAt: null,
  };
  const migrated = migrateWorkspace(legacy, base, catalog);
  assert.equal(migrated.schema, 2);
  assert.equal(migrated.status, "ready");
  assert.deepEqual(migrated.publishedSnapshot, legacy.published);
  assert.deepEqual(migrated.draftSnapshot, legacy.draft);
  assert.deepEqual(migrated.profile.group, "N3347");
  assert.equal(migrated.catalogOverrides.entries.length, 0);
  assert.equal(migrated.catalogSource.type, "legacy-bundled");
  assert.equal(migrated.publishedSelection.web, "web:current");

  const storage = memoryStorage();
  storage.setItem(
    LEGACY_STORAGE_KEY,
    JSON.stringify({ state: legacy, serverRevision: 7, pending: false }),
  );
  const restored = readBrowser(storage, base, catalog);
  assert.equal(restored.migrated, true);
  assert.equal(restored.record.pending, true);
  assert.deepEqual(restored.record.state.publishedSnapshot, base);
  assert.match(restored.error, /перенесено/);
});

test("a new profile starts from live curriculum subjects without the bundled N3347 catalog", () => {
  const onboarding = createOnboardingWorkspace(catalog);
  const profile = {
    group: "M9999",
    faculty: "ФБИТ",
    program: "Тестовая программа",
    academicYear: "2026/2027",
    semester: 5,
    curriculum: {
      courses: [
        { disciplineId: "42", name: "Новый предмет" },
        { disciplineId: "43", name: "Английский язык" },
      ],
    },
  };
  const initialized = initializeWorkspaceProfile(onboarding, profile, base);
  assert.equal(initialized.catalogSource.type, "itmo-public");
  assert.deepEqual(
    initialized.publishedSnapshot.courses.map((course) => course.id),
    ["isu-42", "english"],
  );
  assert.equal(initialized.publishedSnapshot.meta.startDate, "2026-08-31");
  assert.equal(initialized.publishedSnapshot.meta.endDate, "2026-12-27");
  assert.equal(
    effectiveCatalog(
      catalog,
      initialized.catalogOverrides,
      initialized.publishedSnapshot.meta,
      initialized.catalogSource,
    ).entries.length,
    0,
  );
});
test("fresh mode uses a separate browser key and cannot read the regular profile", () => {
  const storage = memoryStorage();
  const regular = { state: seed(), serverRevision: 4, pending: false };
  const testRecord = {
    state: createOnboardingWorkspace(catalog),
    serverRevision: 0,
    pending: true,
  };
  writeBrowser(storage, regular);
  writeBrowser(storage, testRecord, { testMode: true });

  assert.ok(storage.getItem(STORAGE_KEY));
  assert.ok(storage.getItem(TEST_STORAGE_KEY));
  assert.equal(
    readBrowser(storage, base, catalog).record.state.profile.group,
    "N3347",
  );
  assert.equal(
    readBrowser(storage, base, catalog, { testMode: true }).record.state.status,
    "onboarding",
  );
});
test("workspace comparison ignores save metadata but detects schedule changes", () => {
  const left = seed();
  const right = clone(left);
  right.updatedAt = "2099-01-01T00:00:00.000Z";
  right.updatedLocally = true;
  assert.equal(sameWorkspaceContent(left, right), true);
  right.draftSnapshot = selectEntry(right.draftSnapshot, english);
  assert.equal(sameWorkspaceContent(left, right), false);
});
test("storage errors are reported rather than claiming successful autosave", () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.match(writeBrowser(storage, { state: seed() }), /не смог сохранить/);
});
async function temporaryStore(fn) {
  const root = path.resolve("work");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, "storage-test-"));
  try {
    await fn(workspaceStore(dir), dir);
  } finally {
    const relative = path.relative(root, path.resolve(dir));
    assert.ok(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    );
    await rm(dir, { recursive: true, force: true });
  }
}
test("disk saves survive store restart, maintain backup, and reject stale concurrent writers", () =>
  temporaryStore(async (store, dir) => {
    assert.equal((await store.read()).revision, 0);
    const first = await store.save(seed(), 0);
    assert.equal(first.revision, 1);
    const next = seed();
    Object.assign(next, selectDraftEntry(next, english));
    const results = await Promise.allSettled([
      store.save(next, 1),
      store.save(seed(), 1),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      results.find((r) => r.status === "rejected").reason.status,
      409,
    );
    const loaded = await workspaceStore(dir).read();
    assert.equal(loaded.revision, 2);
    assert.deepEqual(loaded.state.draftSnapshot, next.draftSnapshot);
    assert.equal(
      JSON.parse(
        await readFile(path.join(dir, "workspace.json.backup"), "utf8"),
      ).revision,
      1,
    );
  }));
test("disk recovers a damaged primary from backup and never silently overwrites two damaged copies", () =>
  temporaryStore(async (store, dir) => {
    await store.save(seed(), 0);
    await store.save(seed(), 1);
    await writeFile(path.join(dir, "workspace.json"), "broken");
    const recovered = await store.read();
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.revision, 1);
    await writeFile(path.join(dir, "workspace.json.backup"), "also broken");
    await assert.rejects(store.save(seed(), 1), /повреждён/);
    assert.equal(
      await readFile(path.join(dir, "workspace.json"), "utf8"),
      "broken",
    );
  }));
