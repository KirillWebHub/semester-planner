import { BookOpen, CalendarDays, Moon } from "lucide-react";
import { plural } from "../../../shared/lib/calendar-grid.js";

export function ScheduleSummary({ data, metrics, lastTime }) {
  return (
    <div className="summary-grid">
      <div className="summary-card">
        <span className="summary-icon lavender">
          <BookOpen size={20} />
        </span>
        <div>
          <strong>
            {metrics.pairs}
            <span>пар</span>
          </strong>
          <small>на этой неделе</small>
        </div>
        <span className="summary-extra">{metrics.academicHours} акад. ч.</span>
      </div>
      <div className="summary-card">
        <span className="summary-icon mint">
          <CalendarDays size={20} />
        </span>
        <div>
          <strong>
            {metrics.days}
            <span>
              {plural(metrics.days, [
                "учебный день",
                "учебных дня",
                "учебных дней",
              ])}
            </span>
          </strong>
          <small>
            {data.courses.some((course) => course.id === "english")
              ? "английский включён"
              : "английский пока не добавлен"}
          </small>
        </div>
      </div>
      <div className="summary-card">
        <span className={`summary-icon ${metrics.late ? "peach" : "sky"}`}>
          <Moon size={20} />
        </span>
        <div>
          <strong>{lastTime}</strong>
          <small>самое позднее окончание</small>
        </div>
        {metrics.late > 0 && <span className="late-label">ПОЗДНО</span>}
      </div>
    </div>
  );
}
