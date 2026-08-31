import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";
import {
  changedCourses,
  clone,
  findConflicts,
  getAllEvents,
  getMetrics,
  getWeekEvents,
  matchingEntry,
  mergeCatalog,
  publishDraft,
  removeDraftCourse,
  selectEntry,
  selectDraftEntry,
  stageSnapshot,
  validateCatalog,
  validateWorkspace,
} from "../../../entities/schedule/index.js";
import { FlowEditor } from "./FlowEditor";
import { CandidateCard } from "./CandidateCard";
import { DraftPreview } from "./DraftPreview";
import { StoragePanel } from "./StoragePanel";
import {
  BuilderConfirmation,
  BuilderSaveBar,
  PublishReview,
} from "./BuilderFooter";
import { BookEmpty, InfoDot } from "./BuilderIcons";

const OPTIONAL = [
  {
    id: "english",
    name: "Английский язык",
    shortName: "Английский",
    color: "violet",
    hint: "Уровень и поток ещё не выбраны",
  },
  {
    id: "physical",
    name: "Физическая культура",
    shortName: "Физкультура",
    color: "green",
    hint: "Можно добавить свой поток",
  },
];

export function ScheduleBuilder({
  workspace,
  renderCalendar,
  onSelect,
  onPublished,
}) {
  const {
    state,
    update,
    ready,
    status,
    error: storageError,
    diskConflict,
    synchronize,
    loadDisk,
    refreshCatalog,
    catalogStatus,
  } = workspace;
  const { publishedSnapshot: published, draftSnapshot: draft } = state;
  const { catalog } = workspace;
  const [tab, setTab] = useState("flows"),
    [courseId, setCourseId] = useState("english"),
    [week, setWeek] = useState(2);
  const [search, setSearch] = useState(""),
    [editor, setEditor] = useState(null),
    [review, setReview] = useState(false),
    [confirm, setConfirm] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [imported, setImported] = useState(null);
  const fileInput = useRef(null);
  const changed = useMemo(
    () => changedCourses(published, draft),
    [published, draft],
  );
  const events = useMemo(() => getAllEvents(draft), [draft]);
  const conflicts = useMemo(() => findConflicts(events), [events]);
  const weekEvents = useMemo(() => getWeekEvents(draft, week), [draft, week]);
  const metrics = getMetrics(weekEvents);
  const courses = [
    ...new Map(
      [
        ...published.courses,
        ...draft.courses,
        ...OPTIONAL,
        ...catalog.entries.map((e) => e.course),
      ].map((c) => [c.id, c]),
    ).values(),
  ];
  const course = courses.find((c) => c.id === courseId) || courses[0];
  const entries = catalog.entries.filter(
    (e) =>
      e.course.id === course.id &&
      `${e.course.stream} ${e.course.teachers} ${e.slots.map((s) => s.teacher).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selectedEntry = matchingEntry(draft, catalog.entries, course.id);
  const editedCourse = draft.courses.find((c) => c.id === course.id);
  function choose(entry) {
    const candidate = selectEntry(draft, entry);
    const clash = findConflicts(getAllEvents(candidate)).find(
      ([a, b]) =>
        a.courseId === entry.course.id || b.courseId === entry.course.id,
    );
    if (clash) setWeek(clash[0].week);
    else if (
      !getWeekEvents(candidate, week).some(
        (e) => e.courseId === entry.course.id,
      )
    )
      setWeek(Math.min(...entry.slots.flatMap((s) => s.weeks)));
    update((s) => selectDraftEntry(s, entry));
    setReview(false);
    setMessage(
      `В черновике: ${entry.course.shortName}, поток ${entry.course.stream}. Основное расписание не изменено.`,
    );
  }
  async function readImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error("Максимальный размер JSON — 5 МБ.");
      const value = JSON.parse(await file.text());
      if (value.publishedSnapshot || value.published) {
        validateWorkspace(value);
        setImported({
          type: "backup",
          value: workspace.migrate(value),
          name: file.name,
        });
      } else {
        validateCatalog(value, published.meta);
        setImported({ type: "catalog", value, name: file.name });
      }
      setError("");
    } catch (e) {
      setError(`Файл не загружен: ${e.message}`);
    }
  }
  function acceptImport() {
    if (imported.type === "catalog") {
      update((s) => ({
        ...s,
        catalogOverrides: mergeCatalog(
          s.catalogOverrides,
          imported.value,
          s.publishedSnapshot.meta,
        ),
      }));
      setMessage(
        "Каталог обновлён. Сохранённое расписание и черновик не изменены. Выбери обновлённый поток, чтобы применить его занятия.",
      );
    } else {
      // Restoring a backup is staged as a draft; applying still requires explicit confirmation.
      update((s) => {
        const catalogOverrides = mergeCatalog(
          s.catalogOverrides,
          imported.value.catalogOverrides,
          s.publishedSnapshot.meta,
        );
        const importedCatalog = mergeCatalog(
          catalog,
          imported.value.catalogOverrides,
          s.publishedSnapshot.meta,
        );
        return stageSnapshot(
          { ...s, catalogOverrides },
          imported.value.publishedSnapshot,
          importedCatalog,
        );
      });
      setMessage(
        "Расписание из копии открыто в черновике. Проверь его и сохрани, чтобы применить.",
      );
    }
    setImported(null);
    setReview(false);
  }
  const conflictDays = [...new Set(conflicts.map(([a]) => a.date))];
  return (
    <div className="builder">
      <div className="builder-intro">
        <div className="builder-intro-icon">
          <SlidersHorizontal size={24} />
        </div>
        <div>
          <h2>Примерь изменения. Сохрани, когда готов.</h2>
          <p>
            Текущее расписание защищено. Черновик сохраняется автоматически и
            ждёт тебя после перезапуска.
          </p>
        </div>
        <span className="draft-pill">
          <span />
          {changed.length ? `${changed.length} изм.` : "Без изменений"}
        </span>
      </div>
      <div
        className="builder-tabs"
        role="tablist"
        aria-label="Раздел конструктора"
      >
        {[
          ["flows", "Потоки и календарь"],
          ["storage", "Сохранение и данные"],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "flows" && conflicts.length > 0 && (
              <span className="count-alert">{conflictDays.length}</span>
            )}
          </button>
        ))}
      </div>
      <div className="draft-summary">
        <span>
          <ShieldCheck size={17} />
          Основное: {getAllEvents(published).length} пар
        </span>
        <span>Черновик: {events.length} пар</span>
        <span className={conflicts.length ? "danger-text" : "success-text"}>
          {conflicts.length ? (
            <AlertTriangle size={16} />
          ) : (
            <CheckCheck size={17} />
          )}{" "}
          {conflicts.length
            ? `Пересечения: ${conflictDays.length} дат`
            : "Без пересечений за 17 недель"}
        </span>
      </div>
      <div className={`catalog-sync catalog-sync-${catalogStatus.state}`}>
        <div>
          <strong>Открытое расписание ИТМО</strong>
          <span>
            {catalogStatus.message ||
              "Расписание проверяется автоматически при открытии приложения."}
          </span>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={catalogStatus.state === "loading"}
          onClick={refreshCatalog}
        >
          <RefreshCw
            size={16}
            className={catalogStatus.state === "loading" ? "is-spinning" : ""}
          />
          Обновить
        </button>
      </div>
      {!ready && <p role="status">Загружаем сохранённую версию…</p>}
      {error && (
        <p className="builder-error" role="alert">
          {error}
        </p>
      )}
      {storageError && tab !== "storage" && (
        <div className="builder-error" role="alert">
          {storageError}{" "}
          <button className="text-button" onClick={() => setTab("storage")}>
            Сохранение и данные
          </button>
        </div>
      )}
      {message && (
        <p className="builder-message" role="status">
          {message}
        </p>
      )}
      <fieldset disabled={!ready} className="builder-fieldset">
        {tab === "flows" && (
          <div className="builder-combined">
            <div className="selection-panel">
              <label className="subject-dropdown">
                ПРЕДМЕТ
                <select
                  aria-label="Предмет конструктора"
                  value={course.id}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setEditor(null);
                    setSearch("");
                  }}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shortName} ·{" "}
                      {draft.courses.find((x) => x.id === c.id)?.stream ||
                        "не добавлен"}
                      {changed.includes(c.id) ? " •" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flow-workspace">
                {editor ? (
                  <FlowEditor
                    key={editor.key}
                    course={editor.course}
                    entry={editor.entry}
                    meta={draft.meta}
                    onCancel={() => setEditor(null)}
                    onSave={(entry) => {
                      update((s) =>
                        selectDraftEntry(
                          {
                            ...s,
                            catalogOverrides: mergeCatalog(
                              s.catalogOverrides,
                              {
                                schema: 1,
                                updatedAt: new Date().toISOString(),
                                entries: [entry],
                              },
                              s.publishedSnapshot.meta,
                            ),
                          },
                          entry,
                        ),
                      );
                      setCourseId(entry.course.id);
                      setEditor(null);
                      setReview(false);
                      setMessage(
                        "Поток добавлен в каталог и черновик. Для основного расписания нажми «Сохранить расписание».",
                      );
                    }}
                  />
                ) : (
                  <>
                    <div className="builder-section-title">
                      <div>
                        <span className="eyebrow">ВЫБОР ПОТОКА</span>
                        <h2>{course.name}</h2>
                      </div>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          setEditor({ key: crypto.randomUUID(), course })
                        }
                      >
                        <Plus size={16} />
                        Свой поток
                      </button>
                    </div>
                    {course.id === "english" && (
                      <div className="builder-note">
                        <InfoDot />
                        <p>
                          Уровень английского не определён. Достоверного
                          каталога английских потоков пока нет: добавь свой
                          поток с точным временем из ИСУ. Автоматической записи
                          в ИСУ здесь нет.
                        </p>
                      </div>
                    )}
                    {course.id === "safety" && (
                      <div className="builder-note">
                        <InfoDot />
                        <p>
                          ЧС 3.2 уже есть: 26 сентября и 24 октября. Это четыре
                          опубликованные пары, а не полный объём курса.
                          Дополнительный модуль добавляется отдельно и не
                          заменяет 3.2.
                        </p>
                      </div>
                    )}
                    {course.id === "physical" && (
                      <div className="builder-note">
                        <InfoDot />
                        <p>
                          Поток физкультуры ещё не указан. Можно добавить
                          реальные занятия вручную.
                        </p>
                      </div>
                    )}
                    {course.id === "safety" && (
                      <button
                        className="secondary-button module-button"
                        onClick={() =>
                          setEditor({
                            key: crypto.randomUUID(),
                            course: {
                              id: `safety-${crypto.randomUUID()}`,
                              name: "Действия в ЧС · дополнительный модуль",
                              shortName: "ЧС · модуль",
                              color: "slate",
                            },
                          })
                        }
                      >
                        <Plus size={16} />
                        Дополнительный модуль ЧС
                      </button>
                    )}
                    <div className="flow-search">
                      <Search size={17} />
                      <input
                        aria-label="Поиск потока или преподавателя"
                        placeholder="Поток или преподаватель"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <span>{entries.length} вариантов</span>
                    </div>
                    <div className="candidate-list">
                      {entries.map((entry) => (
                        <CandidateCard
                          key={entry.id}
                          entry={entry}
                          course={course}
                          draft={draft}
                          published={published}
                          selectedEntry={selectedEntry}
                          onChoose={choose}
                        />
                      ))}
                    </div>
                    {!entries.length && (
                      <div className="no-candidates">
                        <BookEmpty />
                        <h3>
                          {search
                            ? "Ничего не найдено"
                            : "Пока нет данных о потоках"}
                        </h3>
                        <p>
                          {search
                            ? "Попробуй другой номер или фамилию."
                            : "Добавь поток вручную или загрузи каталог JSON в разделе «Сохранение и данные»."}
                        </p>
                      </div>
                    )}
                    {editedCourse && (
                      <div className="builder-actions">
                        <button
                          className="text-button"
                          onClick={() =>
                            setEditor({
                              key: crypto.randomUUID(),
                              course: editedCourse,
                              entry: {
                                course: editedCourse,
                                slots: draft.slots.filter(
                                  (s) => s.courseId === course.id,
                                ),
                                source: "Изменённая копия расписания",
                              },
                            })
                          }
                        >
                          Изменить занятия этого предмета
                        </button>
                        {["english", "physical"].includes(course.id) ||
                        course.id.startsWith("safety-") ? (
                          <button
                            className="text-button danger-text"
                            onClick={() => {
                              update((s) => removeDraftCourse(s, course.id));
                              setReview(false);
                            }}
                          >
                            Убрать из черновика
                          </button>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <DraftPreview
              draft={draft}
              week={week}
              metrics={metrics}
              conflicts={conflicts}
              conflictDays={conflictDays}
              weekEvents={weekEvents}
              renderCalendar={renderCalendar}
              onWeekChange={setWeek}
              onSelect={onSelect}
            />
          </div>
        )}
        {tab === "storage" && (
          <StoragePanel
            state={state}
            catalog={catalog}
            storageMode={workspace.storageMode}
            status={status}
            storageError={storageError}
            diskConflict={diskConflict}
            imported={imported}
            fileInput={fileInput}
            onSynchronize={synchronize}
            onRequestDiskLoad={() => setConfirm("disk")}
            onImport={readImport}
            onAcceptImport={acceptImport}
            onCancelImport={() => setImported(null)}
            onRestorePrevious={() => {
              update((current) =>
                stageSnapshot(current, current.previousSnapshot, catalog),
              );
              setMessage("Предыдущая версия открыта в черновике.");
              setReview(false);
            }}
          />
        )}
        {confirm && (
          <BuilderConfirmation
            type={confirm}
            onCancel={() => setConfirm("")}
            onConfirm={() => {
              if (confirm === "disk") loadDisk();
              else
                update((current) => ({
                  ...current,
                  draftSnapshot: clone(current.publishedSnapshot),
                  draftSelection: clone(current.publishedSelection),
                }));
              setConfirm("");
              setReview(false);
            }}
          />
        )}
        {review && (
          <PublishReview
            changed={changed}
            published={published}
            draft={draft}
            hasConflicts={conflicts.length > 0}
            onCancel={() => setReview(false)}
            onPublish={() => {
              try {
                update((current) => publishDraft(current));
                setReview(false);
                onPublished();
              } catch (publishError) {
                setError(publishError.message);
              }
            }}
          />
        )}
        <BuilderSaveBar
          changedCount={changed.length}
          status={status}
          hasConflicts={conflicts.length > 0}
          onReset={() => setConfirm("reset")}
          onReview={() => {
            setReview(true);
            setTimeout(
              () =>
                document
                  .querySelector(".publish-review")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" }),
              0,
            );
          }}
        />
      </fieldset>
    </div>
  );
}
