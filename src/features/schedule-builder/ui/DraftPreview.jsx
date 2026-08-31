import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, weekRange } from "../../../entities/schedule/index.js";

export function DraftPreview({
  draft,
  week,
  metrics,
  conflicts,
  conflictDays,
  weekEvents,
  renderCalendar,
  onWeekChange,
  onSelect,
}) {
  return (
    <div className="draft-preview">
      <div className="preview-toolbar">
        <div className="arrow-group">
          <button
            className="icon-button"
            aria-label="Предыдущая неделя черновика"
            disabled={week === 1}
            onClick={() => onWeekChange(week - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Следующая неделя черновика"
            disabled={week === 17}
            onClick={() => onWeekChange(week + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div>
          <strong>{weekRange(draft, week)}</strong>
          <label className="preview-week">
            <select
              aria-label="Неделя черновика"
              value={week}
              onChange={(event) => onWeekChange(Number(event.target.value))}
            >
              {Array.from({ length: 17 }, (_, index) => (
                <option key={index} value={index + 1}>
                  Неделя {index + 1}
                </option>
              ))}
            </select>
            <span>
              {metrics.pairs} пар · {metrics.days} дней · {metrics.bigGaps} окон
              более 40 мин.
            </span>
          </label>
        </div>
      </div>
      {conflicts.length > 0 && (
        <details className="conflict-panel">
          <summary>
            <AlertTriangle size={18} />
            Красным отмечены пересечения · {conflictDays.length} дат за семестр
          </summary>
          <p>
            Сохранение основного расписания доступно после их устранения.
            Переезды между корпусами проверяй отдельно.
          </p>
          <div className="conflict-list">
            {conflicts.slice(0, 30).map(([first, second], index) => (
              <button key={index} onClick={() => onWeekChange(first.week)}>
                <strong>
                  {formatDate(first.date)} · неделя {first.week}
                </strong>
                <span>
                  {first.course.shortName} {first.start}–{first.end} ↔{" "}
                  {second.course.shortName} {second.start}–{second.end}
                </span>
              </button>
            ))}
            {conflicts.length > 30 && (
              <p>Показаны первые 30 из {conflicts.length} пересечений.</p>
            )}
          </div>
        </details>
      )}
      {renderCalendar({
        data: draft,
        week,
        events: weekEvents,
        allWeekEvents: weekEvents,
        onSelect,
      })}
      <p className="preview-caption">
        Это черновик. Основное расписание пока не изменилось. Проверка
        конфликтов учитывает точные недели, но не время дороги.
      </p>
    </div>
  );
}
