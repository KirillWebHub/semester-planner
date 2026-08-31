import {
  ArrowDownToLine,
  CheckCheck,
  FolderSync,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { exportJson, getAllEvents } from "../../../entities/schedule/index.js";

export function StoragePanel({
  state,
  catalog,
  storageMode,
  status,
  storageError,
  diskConflict,
  imported,
  fileInput,
  onSynchronize,
  onRequestDiskLoad,
  onImport,
  onAcceptImport,
  onCancelImport,
  onRestorePrevious,
}) {
  const browserOnly = storageMode === "browser";
  return (
    <div className="storage-grid">
      <section className="storage-card">
        <span className="storage-icon">
          <ShieldCheck size={25} />
        </span>
        <h2>
          {browserOnly
            ? "Личный профиль в этом браузере"
            : "Две копии. Один твой выбор."}
        </h2>
        <p>
          {browserOnly ? (
            <>
              Профиль, выбранные потоки и снимки расписания хранятся локально.
              Другие посетители сайта не видят и не изменяют эти данные.
            </>
          ) : (
            <>
              Профиль, выбор потоков и снимки расписания сохраняются в браузере
              и в <code>user-data/workspace.json</code> внутри проекта.
              Перезапуск приложения и обновление кода не сбрасывают расписание.
            </>
          )}
        </p>
        <div className="save-state">
          <CheckCheck size={17} />
          {status}
        </div>
        {storageError && (
          <p role="alert" className="builder-error">
            {storageError}
          </p>
        )}
        <div className="builder-actions">
          {!browserOnly && (
            <button className="secondary-button" onClick={onSynchronize}>
              <FolderSync size={16} />
              Синхронизировать с диском
            </button>
          )}
          <button
            className="secondary-button"
            onClick={() => exportJson(state, "semester-backup.json")}
          >
            <ArrowDownToLine size={16} />
            Резервная копия JSON
          </button>
        </div>
        {!browserOnly && diskConflict && (
          <button
            className="text-button danger-text"
            onClick={onRequestDiskLoad}
          >
            Загрузить версию с диска
          </button>
        )}
        <p className="muted-copy">
          {browserOnly
            ? "Это не облако: после очистки данных браузера профиль исчезнет. JSON-копию можно скачать и перенести на другой компьютер."
            : "Это локальное сохранение, не облако. JSON-копию можно перенести на другой компьютер. Очистка браузера не затрагивает файл проекта; удаление папки проекта удалит и этот файл."}
        </p>
      </section>

      <section className="storage-card">
        <span className="storage-icon mint">
          <FolderSync size={25} />
        </span>
        <h2>Каталог отдельно от расписания</h2>
        <p>
          {catalog.entries.length} вариантов потоков. Учебный план нового
          профиля определяется по открытым данным ИСУ. Точное расписание потоков
          загружается с публичной страницы расписания ИТМО, когда университет
          его опубликовал. До публикации поток можно добавить вручную.
        </p>
        <div className="builder-actions">
          <button
            className="secondary-button"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} />
            Импорт JSON
          </button>
          <button
            className="text-button"
            onClick={() => exportJson(catalog, "semester-catalog.json")}
          >
            Скачать каталог
          </button>
        </div>
        <input
          hidden
          type="file"
          accept=".json,application/json"
          ref={fileInput}
          onChange={onImport}
        />
        <p className="muted-copy">
          Каталог: schema, updatedAt, entries. Обновляются записи с одинаковым
          ID; отсутствующие записи не удаляются. Импорт резервной копии
          открывает её основное расписание в черновике, не заменяя твоё
          основное.
        </p>
        {imported && (
          <div className="import-review">
            <strong>{imported.name}</strong>
            <p>
              {imported.type === "catalog"
                ? `${imported.value.entries.length} потоков. Основное расписание и черновик останутся прежними.`
                : `${getAllEvents(imported.value.publishedSnapshot || imported.value.published).length} пар из резервной копии будут открыты в черновике.`}
            </p>
            <div className="builder-actions">
              <button className="primary-button" onClick={onAcceptImport}>
                Подтвердить импорт
              </button>
              <button className="text-button" onClick={onCancelImport}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="storage-card history-card">
        <h2>Можно вернуться назад</h2>
        <p>
          Предыдущая применённая версия хранится отдельно. Восстановление
          сначала открывает её в черновике.
        </p>
        <button
          className="secondary-button"
          disabled={!state.previousSnapshot}
          onClick={onRestorePrevious}
        >
          Открыть предыдущую версию
        </button>
      </section>
    </div>
  );
}
