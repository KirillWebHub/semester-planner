import { ArrowUpRight, BookOpen, Info } from "lucide-react";

export function FlowsPage({ data, onCourseClick }) {
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">ТВОЙ НАБОР</span>
          <h2>{data.courses.length} предметов в твоём расписании.</h2>
          <p>
            Это сохранённый набор. Изменить его можно в конструкторе; наличие
            мест и запись на поток проверяются в ИСУ.
          </p>
        </div>
      </div>
      <div className="flows-grid">
        {data.courses.map((course, index) => (
          <button
            key={course.id}
            className={`flow-card theme-${course.color}`}
            onClick={() => onCourseClick(course.id)}
          >
            <div className="flow-card-top">
              <span className="flow-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flow-pill">Поток {course.stream}</span>
            </div>
            <h3>{course.name}</h3>
            <p>{course.teachers}</p>
            <div className="flow-card-bottom">
              <span>
                {data.slots
                  .filter((slot) => slot.courseId === course.id)
                  .reduce((sum, slot) => sum + slot.weeks.length, 0)}{" "}
                пар в расписании
              </span>
              <ArrowUpRight size={17} />
            </div>
          </button>
        ))}
      </div>
      <div className="notice neutral">
        <Info size={18} />
        <div>
          <strong>
            Номера лекционного и практического потоков различаются.
          </strong>
          <p>
            Здесь показан выбранный практический поток; общие лекции уже
            включены. ТиМП 1.1 и 1.2 занимаются вместе. Чешев Н. указан только в
            примечании ИСУ.
          </p>
        </div>
      </div>
      <div className="notice neutral">
        <BookOpen size={18} />
        <div>
          <strong>Английский, физкультура и ЧС</strong>
          <p>
            {data.courses.some((c) => c.id === "english")
              ? "Английский добавлен. "
              : "Английский пока не добавлен. "}
            {data.courses.some((c) => c.id === "physical")
              ? "Физкультура добавлена. "
              : "Физкультура пока не добавлена. "}
            ЧС 3.2 в исходной версии содержит четыре пары. Дополнительные
            занятия можно внести через конструктор.
          </p>
        </div>
      </div>
    </>
  );
}
