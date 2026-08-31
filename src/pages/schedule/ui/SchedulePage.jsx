import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCheck, Info } from "lucide-react";
import {
  findConflicts,
  getAllEvents,
  getMetrics,
  getWeekEvents,
  toMinutes,
} from "../../../entities/schedule/index.js";
import { WeekAgenda } from "../../../widgets/week-agenda/index.js";
import { WeekCalendar } from "../../../widgets/week-calendar/index.js";
import { ScheduleSummary } from "./ScheduleSummary.jsx";
import { ScheduleToolbar } from "./ScheduleToolbar.jsx";

export function SchedulePage({
  data,
  initialWeek = 1,
  initialCourseFilter = "all",
  onSelect,
}) {
  const [week, setWeek] = useState(initialWeek);
  const [view, setView] = useState(() =>
    window.matchMedia("(max-width: 560px)").matches ? "list" : "week",
  );
  const [filter, setFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState(initialCourseFilter);
  const allEvents = useMemo(() => getAllEvents(data), [data]);
  const weekEvents = useMemo(() => getWeekEvents(data, week), [data, week]);
  const visibleEvents = weekEvents.filter(
    (event) =>
      (filter === "all" || event.kind === filter) &&
      (courseFilter === "all" || event.courseId === courseFilter),
  );
  const metrics = getMetrics(weekEvents);
  const lastTime = weekEvents.reduce(
    (result, event) =>
      toMinutes(event.end) > toMinutes(result) ? event.end : result,
    "0:00",
  );
  const hasSafety = weekEvents.some((event) => event.courseId === "safety");
  const noConflicts = useMemo(
    () => findConflicts(allEvents).length === 0,
    [allEvents],
  );

  return (
    <>
      <ScheduleSummary data={data} metrics={metrics} lastTime={lastTime} />
      <section
        className="schedule-section"
        aria-label="Расписание выбранной недели"
      >
        <ScheduleToolbar
          data={data}
          week={week}
          view={view}
          filter={filter}
          courseFilter={courseFilter}
          onWeekChange={setWeek}
          onViewChange={setView}
          onFilterChange={setFilter}
          onCourseFilterChange={setCourseFilter}
        />
        {view === "week" ? (
          <WeekCalendar
            data={data}
            week={week}
            events={visibleEvents}
            allWeekEvents={weekEvents}
            onSelect={onSelect}
          />
        ) : (
          <WeekAgenda
            data={data}
            week={week}
            events={visibleEvents}
            allWeekEvents={weekEvents}
            onSelect={onSelect}
          />
        )}
        <div className="calendar-footer">
          <span>
            <span className="small-dot" />
            {filter === "all" && courseFilter === "all"
              ? "Показаны все занятия недели"
              : `По фильтру: ${visibleEvents.length} из ${weekEvents.length} занятий`}
          </span>
          <span>
            Нажми на пару, чтобы узнать детали <ArrowUpRight size={13} />
          </span>
        </div>
      </section>
      <div className="below-calendar">
        <div className="week-note">
          <Info size={18} />
          <div>
            <strong>
              {hasSafety
                ? "На этой неделе есть ЧС"
                : "Точные даты, сохранённый выбор"}
            </strong>
            <p>
              В сетке учтены точные номера недель и отдельные даты. Изменения в
              конструкторе не попадут сюда, пока ты не применишь их. Проверяй
              корпус и формат в карточке занятия.
            </p>
          </div>
        </div>
        <div className="verified-badge">
          <CheckCheck size={19} />
          <span>
            {noConflicts ? "Без пересечений" : "Есть пересечения"}
            <small>проверено по всем 17 неделям</small>
          </span>
        </div>
      </div>
    </>
  );
}
