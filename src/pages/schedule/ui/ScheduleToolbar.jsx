import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { weekRange } from "../../../entities/schedule/index.js";

const FILTERS = [
  { id: "all", name: "Все занятия" },
  { id: "lecture", name: "Лекции" },
  { id: "lab", name: "Лабораторные" },
  { id: "practice", name: "Практики" },
];

export function ScheduleToolbar({
  data,
  week,
  view,
  filter,
  courseFilter,
  onWeekChange,
  onViewChange,
  onFilterChange,
  onCourseFilterChange,
}) {
  return (
    <>
      <div className="schedule-toolbar">
        <div className="week-navigation">
          <div className="arrow-group">
            <button
              className="icon-button"
              disabled={week === 1}
              onClick={() => onWeekChange(week - 1)}
              aria-label="Предыдущая неделя"
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="icon-button"
              disabled={week === 17}
              onClick={() => onWeekChange(week + 1)}
              aria-label="Следующая неделя"
            >
              <ChevronRight size={19} />
            </button>
          </div>
          <div>
            <h2>{weekRange(data, week)}</h2>
            <div className="week-subtitle">
              <label htmlFor="week-select">Неделя</label>
              <select
                id="week-select"
                aria-label="Учебная неделя"
                value={week}
                onChange={(event) => onWeekChange(Number(event.target.value))}
              >
                {Array.from({ length: 17 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {String(index + 1).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span className={`parity-pill ${week % 2 ? "odd" : "even"}`}>
                {week % 2 ? "нечётная" : "чётная"}
              </span>
              <button
                className="reset-week"
                onClick={() => onWeekChange(1)}
                disabled={week === 1}
              >
                К началу
              </button>
            </div>
          </div>
        </div>
        <div className="view-switch" aria-label="Вид расписания">
          <button
            aria-pressed={view === "week"}
            onClick={() => onViewChange("week")}
            aria-label="Неделя"
            className={view === "week" ? "selected" : ""}
          >
            <CalendarDays size={16} />
            <span>Неделя</span>
          </button>
          <button
            aria-pressed={view === "list"}
            onClick={() => onViewChange("list")}
            aria-label="Список"
            className={view === "list" ? "selected" : ""}
          >
            <List size={17} />
            <span>Список</span>
          </button>
        </div>
      </div>
      <div className="filter-toolbar">
        <div className="filter-pills" aria-label="Тип занятия">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? "selected" : ""}
              aria-pressed={filter === item.id}
              onClick={() => onFilterChange(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <label className="course-select">
          <span className="sr-only">Предмет</span>
          <select
            aria-label="Предмет"
            value={courseFilter}
            onChange={(event) => onCourseFilterChange(event.target.value)}
          >
            <option value="all">Все предметы</option>
            {data.courses.map((course) => (
              <option value={course.id} key={course.id}>
                {course.shortName}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
