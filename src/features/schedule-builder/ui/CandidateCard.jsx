import { Check, ChevronRight, Clock3 } from "lucide-react";
import {
  DAY_SHORT,
  KIND_NAMES,
  findConflicts,
  getAllEvents,
  locationLabel,
  matchingEntry,
  selectEntry,
  shortTeacher,
} from "../../../entities/schedule/index.js";

export function CandidateCard({
  entry,
  course,
  draft,
  published,
  selectedEntry,
  onChoose,
}) {
  const active = selectedEntry?.id === entry.id;
  const saved = matchingEntry(published, [entry], course.id);
  const candidate = selectEntry(draft, entry);
  const clashes = findConflicts(getAllEvents(candidate)).filter(
    ([first, second]) =>
      first.courseId === course.id || second.courseId === course.id,
  );
  const practices = entry.slots.filter((slot) => slot.kind !== "lecture");
  const distinct = [
    ...new Map(
      practices.map((slot) => [
        `${slot.day}-${slot.start}-${slot.end}-${slot.teacher}`,
        slot,
      ]),
    ).values(),
  ];
  const teachers = [
    ...new Set(
      practices.map((slot) =>
        slot.teacher === "-" ? slot.note : shortTeacher(slot.teacher),
      ),
    ),
  ].join(" · ");

  return (
    <article className={`candidate-card ${active ? "is-selected" : ""}`}>
      <div className="candidate-top">
        <div>
          <strong>Поток {entry.course.stream}</strong>
          {saved && <span className="saved-chip">В основном</span>}
          {entry.origin === "manual" && (
            <span className="saved-chip">Вручную</span>
          )}
        </div>
        <button
          className={active ? "selected-button" : "secondary-button"}
          aria-label={`Выбрать ${course.shortName} ${entry.course.stream}`}
          onClick={() => onChoose(entry)}
          disabled={active}
        >
          {active ? (
            <>
              <Check size={15} />В черновике
            </>
          ) : (
            <>
              Выбрать
              <ChevronRight size={15} />
            </>
          )}
        </button>
      </div>
      <p className="candidate-teacher">{teachers}</p>
      <div className="candidate-times">
        {distinct.slice(0, 5).map((slot, index) => (
          <span key={index}>
            <Clock3 size={13} />
            {DAY_SHORT[slot.day]} {slot.start}–{slot.end}
          </span>
        ))}
        {distinct.length > 5 && <span>+{distinct.length - 5} интервалов</span>}
      </div>
      <div className="candidate-bottom">
        <span>
          {entry.slots.reduce((sum, slot) => sum + slot.weeks.length, 0)} пар ·{" "}
          {entry.slots.some((slot) => slot.kind === "lecture")
            ? "лекции включены"
            : "без общих лекций"}
        </span>
        <span className={clashes.length ? "danger-text" : "success-text"}>
          {clashes.length
            ? `${new Set(clashes.map(([event]) => event.date)).size} дат с пересечениями`
            : "Без пересечений с черновиком"}
        </span>
      </div>
      <details>
        <summary>Все занятия и недели</summary>
        <p className="candidate-source">{entry.source}</p>
        {entry.slots.map((slot) => (
          <div className="slot-detail" key={slot.id}>
            <strong>
              {DAY_SHORT[slot.day]} {slot.start}–{slot.end} ·{" "}
              {KIND_NAMES[slot.kind]}
            </strong>
            <span>
              Недели: {slot.weeks.join(", ")} · {locationLabel(slot)}
            </span>
            <small>
              {slot.teacher === "-" ? "Преподаватель не указан" : slot.teacher}
            </small>
          </div>
        ))}
      </details>
    </article>
  );
}
