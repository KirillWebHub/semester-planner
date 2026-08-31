import {
  migrateWorkspace,
  validateWorkspace,
} from "../../../entities/schedule/model/index.js";

export const STORAGE_KEY = "semester-planner:workspace:v2";
export const TEST_STORAGE_KEY = "semester-planner:workspace:sandbox:v3";
export const LEGACY_STORAGE_KEY = "semester:n3347:workspace:v1";

export function readBrowser(
  storage,
  baseSchedule,
  sharedCatalog,
  { testMode = false } = {},
) {
  let error = "";
  const keys = testMode
    ? [TEST_STORAGE_KEY, `${TEST_STORAGE_KEY}:backup`]
    : [
        STORAGE_KEY,
        `${STORAGE_KEY}:backup`,
        LEGACY_STORAGE_KEY,
        `${LEGACY_STORAGE_KEY}:backup`,
      ];
  for (const key of keys) {
    try {
      const text = storage.getItem(key);
      if (!text) continue;
      const record = JSON.parse(text);
      validateWorkspace(record.state);
      const migratedState = migrateWorkspace(
        record.state,
        baseSchedule,
        sharedCatalog,
      );
      const migrated = migratedState !== record.state;
      return {
        record: {
          ...record,
          state: migratedState,
          pending: migrated || record.pending,
        },
        error: key.endsWith(":backup")
          ? "Основная копия браузера повреждена. Открыта резервная."
          : migrated
            ? "Расписание N3347 перенесено в новый формат профиля."
            : error,
        migrated,
      };
    } catch {
      error =
        "Копия браузера недоступна или повреждена. Проверяем файл проекта.";
    }
  }
  return { record: null, error };
}
export function writeBrowser(storage, record, { testMode = false } = {}) {
  try {
    validateWorkspace(record.state);
    const storageKey = testMode ? TEST_STORAGE_KEY : STORAGE_KEY;
    const existing = storage.getItem(storageKey);
    if (existing) {
      try {
        validateWorkspace(JSON.parse(existing).state);
        storage.setItem(`${storageKey}:backup`, existing);
      } catch {
        /* Never replace a valid backup with corrupt data. */
      }
    }
    storage.setItem(storageKey, JSON.stringify(record));
    return "";
  } catch {
    return "Браузер не смог сохранить данные. Скачай резервную копию JSON.";
  }
}
