import { Coffee, Layers3 } from "lucide-react";
import {
  DAY_NAMES,
  DAY_SHORT,
  LessonCard,
  layoutEvents,
  toMinutes,
  weekDate,
} from "../../../entities/schedule/index.js";
import {
  GRID_END,
  GRID_START,
  TIME_MARKS,
  plural,
  position,
} from "../../../shared/lib/calendar-grid";

export function WeekCalendar({ data, week, events, allWeekEvents, onSelect }) {
  const days = allWeekEvents.some((e) => e.day === 6)
    ? DAY_NAMES
    : DAY_NAMES.slice(0, 6);
  const gridStart = Math.min(
    GRID_START,
    ...allWeekEvents.map((e) => toMinutes(e.start) - 10),
  );
  const gridEnd = Math.max(
    GRID_END,
    ...allWeekEvents.map((e) => toMinutes(e.end) + 10),
  );
  const layouts = layoutEvents(allWeekEvents);
  const marks = [
    ...new Set([...TIME_MARKS, ...allWeekEvents.map((e) => e.start)]),
  ]
    .filter((t) => toMinutes(t) >= gridStart && toMinutes(t) <= gridEnd)
    .sort((a, b) => toMinutes(a) - toMinutes(b));
  return (
    <div className="calendar-scroll" aria-label="Календарь недели">
      <div
        className="calendar-grid"
        style={{
          gridTemplateColumns: `55px ${days
            .map((_, day) => {
              const lanes = Math.max(
                1,
                ...allWeekEvents
                  .filter((e) => e.day === day)
                  .map((e) => layouts.get(e.occurrenceId)?.lanes || 1),
              );
              return lanes > 1
                ? `minmax(${lanes * 80}px,${lanes * 0.85}fr)`
                : "minmax(85px,1fr)";
            })
            .join(" ")}`,
        }}
      >
        <div className="calendar-corner">
          <span>МСК</span>
        </div>
        {days.map((day, index) => {
          const count = allWeekEvents.filter(
            (event) => event.day === index,
          ).length;
          return (
            <div
              className={`day-header ${count === 0 ? "day-is-free" : ""}`}
              key={day}
            >
              <span className="day-name">{DAY_SHORT[index]}</span>
              <strong>{Number(weekDate(data, week, index).slice(-2))}</strong>
              <small>
                {count
                  ? `${count} ${plural(count, ["пара", "пары", "пар"])}`
                  : "свободно"}
              </small>
            </div>
          );
        })}
        <div className="time-axis">
          {marks.map((time) => (
            <span
              key={time}
              style={{ top: position(time, gridStart, gridEnd) }}
            >
              {time}
            </span>
          ))}
        </div>
        {days.map((day, index) => {
          const dayEvents = events.filter((event) => event.day === index);
          const actuallyFree = !allWeekEvents.some(
            (event) => event.day === index,
          );
          return (
            <div
              className={`day-column ${actuallyFree ? "free-column" : ""}`}
              key={day}
            >
              {marks.map((time) => (
                <div
                  className="time-line"
                  key={time}
                  style={{ top: position(time, gridStart, gridEnd) }}
                />
              ))}
              {!dayEvents.length && (
                <div className="empty-day">
                  {actuallyFree ? (
                    <Coffee size={23} strokeWidth={1.4} />
                  ) : (
                    <Layers3 size={21} strokeWidth={1.4} />
                  )}
                  <span>
                    {actuallyFree
                      ? "Можно выдохнуть"
                      : "Нет занятий\nпо фильтру"}
                  </span>
                </div>
              )}
              {dayEvents.map((event) => (
                <LessonCard
                  layout={layouts.get(event.occurrenceId)}
                  gridStart={gridStart}
                  gridEnd={gridEnd}
                  key={event.occurrenceId}
                  event={event}
                  onSelect={onSelect}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
