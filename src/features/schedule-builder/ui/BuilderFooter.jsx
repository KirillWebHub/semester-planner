import { Check, Save } from "lucide-react";

export function BuilderConfirmation({ type, onConfirm, onCancel }) {
  return (
    <div className="inline-confirm" role="alert">
      <strong>
        {type === "disk"
          ? "Заменить локальную версию данными с диска?"
          : "Сбросить черновик до основного расписания?"}
      </strong>
      <p>
        {type === "disk"
          ? "Сначала скачай JSON-копию, чтобы сохранить свои несинхронизированные изменения."
          : "Выбор потоков в черновике будет сброшен. Основное расписание и каталог не изменятся."}
      </p>
      <div className="builder-actions">
        <button className="primary-button" onClick={onConfirm}>
          Подтвердить
        </button>
        <button className="text-button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}

export function PublishReview({
  changed,
  published,
  draft,
  hasConflicts,
  onPublish,
  onCancel,
}) {
  return (
    <section className="publish-review">
      <h3>Сохранить эту версию как основную?</h3>
      <p>
        Изменятся {changed.length} предмета. Предыдущая версия останется для
        восстановления.
      </p>
      <div className="change-list">
        {changed.map((id) => {
          const before = published.courses.find((course) => course.id === id);
          const after = draft.courses.find((course) => course.id === id);
          return (
            <div key={id}>
              <strong>{(after || before).shortName}</strong>
              <span>
                {before?.stream || "Не добавлен"} → {after?.stream || "Убран"}
                {before?.stream === after?.stream ? " · изменены занятия" : ""}
              </span>
            </div>
          );
        })}
      </div>
      <button
        className="primary-button"
        disabled={hasConflicts}
        onClick={onPublish}
      >
        <Check size={17} />
        Применить изменения
      </button>
      <button className="text-button" onClick={onCancel}>
        Продолжить редактирование
      </button>
    </section>
  );
}

export function BuilderSaveBar({
  changedCount,
  status,
  hasConflicts,
  onReset,
  onReview,
}) {
  return (
    <div className="builder-savebar">
      <div>
        <span className="save-indicator" />
        <span>
          <strong>
            {changedCount
              ? "Черновик отдельно от основного"
              : "Основное расписание без изменений"}
          </strong>
          <small>{status}</small>
        </span>
      </div>
      <div className="builder-actions">
        <button
          className="text-button"
          disabled={!changedCount}
          onClick={onReset}
        >
          Сбросить черновик
        </button>
        <button
          className="primary-button"
          disabled={!changedCount || hasConflicts}
          onClick={onReview}
        >
          <Save size={16} />
          Сохранить расписание
        </button>
      </div>
    </div>
  );
}
