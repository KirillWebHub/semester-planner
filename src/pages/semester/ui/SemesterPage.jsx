import { ArrowUpRight, CheckCheck } from "lucide-react";
import {
  DAY_NAMES,
  getMetrics,
  getWeekEvents,
  weekRange,
} from "../../../entities/schedule/index.js";
import { plural } from "../../../shared/lib/calendar-grid";

export function SemesterPage({ data, onWeekClick, allEvents }) {
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">СМОТРИМ ЧУТЬ ДАЛЬШЕ</span>
          <h2>Семестр одним взглядом</h2>
          <p>
            Выбери неделю, чтобы открыть её точное расписание. Цветная точка
            отмечает занятия после 20:20.
          </p>
        </div>
      </div>
      <div className="semester-grid">
        {Array.from({ length: 17 }, (_, index) => {
          const week = index + 1,
            metrics = getMetrics(getWeekEvents(data, week));
          return (
            <button
              className="semester-week"
              key={week}
              onClick={() => onWeekClick(week)}
              aria-label={`Открыть неделю ${week}`}
            >
              <div>
                <span>Неделя {String(week).padStart(2, "0")}</span>
                {metrics.late > 0 ? (
                  <span className="late-dot" title="Есть занятия после 20:20" />
                ) : (
                  <ArrowUpRight size={15} />
                )}
              </div>
              <strong>{weekRange(data, week)}</strong>
              <div className="week-mini-bars">
                {DAY_NAMES.map((day, dayIndex) => (
                  <i
                    key={day}
                    style={{
                      height: `${8 + getWeekEvents(data, week).filter((event) => event.day === dayIndex).length * 6}px`,
                    }}
                  />
                ))}
              </div>
              <small>
                {metrics.pairs} пар · {metrics.days}{" "}
                {plural(metrics.days, [
                  "учебный день",
                  "учебных дня",
                  "учебных дней",
                ])}
              </small>
            </button>
          );
        })}
      </div>
      <div className="semester-bottom">
        <div className="semester-summary">
          <CheckCheck size={22} />
          <h3>Проверены все 17 недель</h3>
          <p>
            {allEvents.length} опубликованных пар.{" "}
            {/* {findConflicts(allEvents).length === 0
              ? "Пересечений по времени нет."
              : "Есть пересечения — проверь расписание."}{" "}
            Проверяются только внесённые занятия. Полноту учебного плана,
            наличие мест и время переездов проверь отдельно. */}
          </p>
        </div>
        <div className="sources">
          <h3>Откуда данные</h3>
          <p>
            Снимок расписания на 28 августа 2026 года. Автоматического
            обновления из ИСУ нет.
          </p>
          {data.meta.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.label}
              <ArrowUpRight size={15} />
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
