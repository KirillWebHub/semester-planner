import { AlertTriangle, ArrowUpRight, MapPin, Video } from "lucide-react";
import {
  DAY_NAMES,
  KIND_NAMES,
  locationLabel,
  shortTeacher,
  toMinutes,
} from "../model/calendar.js";
import {
  GRID_END,
  GRID_START,
  position,
} from "../../../shared/lib/calendar-grid.js";

export function LessonCard({
  event,
  onSelect,
  compact = false,
  gridStart = GRID_START,
  gridEnd = GRID_END,
  layout,
}) {
  const clashes = layout?.conflicts || [];
  return (
    <button
      className={`lesson-card theme-${event.course.color} ${compact ? "list-lesson" : ""} ${clashes.length ? "lesson-conflict" : ""}`}
      title={
        clashes.length
          ? `Пересечение: ${clashes.map((e) => `${e.course.shortName} ${e.start}–${e.end}`).join("; ")}`
          : undefined
      }
      onClick={() => onSelect({ ...event, conflicts: clashes })}
      style={
        compact
          ? undefined
          : {
              top: position(event.start, gridStart, gridEnd),
              ...(layout?.lanes > 1
                ? {
                    left: `calc(${(layout.lane * 100) / layout.lanes}% + 3px)`,
                    width: `calc(${100 / layout.lanes}% - 6px)`,
                    right: "auto",
                  }
                : {}),
              height: `${((toMinutes(event.end) - toMinutes(event.start)) / (gridEnd - gridStart)) * 100}%`,
            }
      }
      aria-label={`${event.course.name}, ${KIND_NAMES[event.kind]}, ${event.start}–${event.end}, ${DAY_NAMES[event.day]}${clashes.length ? `, пересечение с ${clashes.map((e) => e.course.shortName).join(", ")}` : ""}`}
    >
      <div className="lesson-time">
        <span>
          {event.start}
          <span className="time-dash"> — </span>
          {event.end}
        </span>
        {event.format !== "campus" && <Video size={12} />}
      </div>
      <strong className="lesson-name">{event.course.shortName}</strong>
      {clashes.length > 0 && (
        <span className="conflict-badge">
          <AlertTriangle size={10} />
          Пересечение
        </span>
      )}
      <div className="lesson-kind">
        {KIND_NAMES[event.kind]}
        <span>
          {" "}
          · {event.kind === "lecture" ? "общая" : event.course.stream}
        </span>
      </div>
      {compact && (
        <div className="list-teacher">{shortTeacher(event.teacher)}</div>
      )}
      <div className="lesson-location">
        <MapPin size={11} />
        <span>{locationLabel(event)}</span>
      </div>
      {compact && <ArrowUpRight className="list-arrow" size={18} />}
    </button>
  );
}
