import { Coffee } from "lucide-react";
import {
  DAY_NAMES,
  DAY_SHORT,
  LessonCard,
  formatDate,
  layoutEvents,
  weekDate,
} from "../../../entities/schedule/index.js";

export function WeekAgenda({ data, week, events, allWeekEvents, onSelect }) {
  const layouts = layoutEvents(allWeekEvents);
  const days = allWeekEvents.some((e) => e.day === 6)
    ? DAY_NAMES
    : DAY_NAMES.slice(0, 6);
  return (
    <div className="agenda">
      {days.map((day, index) => {
        const items = events.filter((event) => event.day === index);
        const empty = !allWeekEvents.some((event) => event.day === index);
        return (
          <section
            className={`agenda-day ${items.length ? "" : "agenda-empty"}`}
            key={day}
          >
            <div className="agenda-date">
              <span>{DAY_SHORT[index]}</span>
              <strong>{Number(weekDate(data, week, index).slice(-2))}</strong>
              <small>
                {formatDate(weekDate(data, week, index), {
                  day: undefined,
                  month: "short",
                })}
              </small>
            </div>
            <div className="agenda-content">
              <h3>{day}</h3>
              {items.length ? (
                <div className="agenda-lessons">
                  {items.map((event) => (
                    <LessonCard
                      layout={layouts.get(event.occurrenceId)}
                      compact
                      key={event.occurrenceId}
                      event={event}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              ) : (
                <p>
                  <Coffee size={16} />
                  {empty
                    ? "Занятий из выбранного списка нет"
                    : "Нет занятий по этому фильтру"}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
