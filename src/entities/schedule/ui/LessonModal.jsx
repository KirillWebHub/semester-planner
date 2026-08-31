import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  GraduationCap,
  Info,
  MapPin,
  Video,
  X,
} from "lucide-react";
import {
  DAY_NAMES,
  KIND_NAMES,
  formatDate,
  locationLabel,
} from "../model/calendar.js";

export function LessonModal({ event, onClose }) {
  const modalRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.querySelector("button")?.focus();
    function onKey(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const buttons = [
          ...modalRef.current.querySelectorAll(
            'button, a[href], input, select, [tabindex="0"]',
          ),
        ];
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(click) => {
        if (click.target === click.currentTarget) onClose();
      }}
    >
      <section
        className={`lesson-modal theme-${event.course.color}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-title"
        ref={modalRef}
      >
        <div className="modal-top">
          <span className="kind-badge">{KIND_NAMES[event.kind]}</span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Закрыть занятие"
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="lesson-title">{event.course.name}</h2>
        <p className="modal-stream">
          {event.kind === "lecture"
            ? "Общая лекция"
            : `Поток ${event.course.stream}`}{" "}
          <span>·</span> {event.week}-я учебная неделя
        </p>
        <>
          {event.conflicts?.length > 0 && (
            <div className="modal-conflicts">
              <strong>
                <AlertTriangle size={16} />
                Пересечение по времени
              </strong>
              {event.conflicts.map((other) => (
                <p key={other.occurrenceId}>
                  {other.course.name} · {other.start}–{other.end}
                </p>
              ))}
            </div>
          )}
        </>
        <div className="detail-rows">
          <div>
            <CalendarDays />
            <span>
              <small>Когда</small>
              <strong>
                {DAY_NAMES[event.day]},{" "}
                {formatDate(event.date, { month: "long" })}
              </strong>
            </span>
          </div>
          <div>
            <Clock3 />
            <span>
              <small>Время · Москва</small>
              <strong>
                {event.start} — {event.end}
              </strong>
            </span>
          </div>
          <div>
            <GraduationCap />
            <span>
              <small>Преподаватель</small>
              <strong>
                {event.teacher === "-" ? "В поле ИСУ не указан" : event.teacher}
              </strong>
              {event.teacher === "-" && event.note !== "-" && (
                <em>{event.note}</em>
              )}
            </span>
          </div>
          <div>
            {event.format === "campus" ? <MapPin /> : <Video />}
            <span>
              <small>
                {event.format === "campus"
                  ? "Аудитория и корпус"
                  : "Формат занятия"}
              </small>
              <strong>
                {event.format === "campus" ? event.room : locationLabel(event)}
              </strong>
              {event.format !== "campus" && (
                <em>Ссылка на подключение — в ИСУ или материалах курса.</em>
              )}
            </span>
          </div>
        </div>
        {event.note && event.note !== "-" && (
          <div className="modal-note">
            <Info size={16} />
            <span>Примечание ИСУ: {event.note.replace(/^:\s*/, "")}</span>
          </div>
        )}
        <div className="modal-footer">
          {event.stream}
          <span>Сохранённая запись</span>
        </div>
      </section>
    </div>
  );
}
