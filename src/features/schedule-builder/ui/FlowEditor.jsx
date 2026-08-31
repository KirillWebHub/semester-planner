import { useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import {
  DAY_NAMES,
  KIND_NAMES,
  parseWeeks,
  validateCatalog,
} from "../../../entities/schedule/index.js";

const blankLesson = () => ({
  day: 2,
  start: "",
  end: "",
  weeksText: "",
  kind: "practice",
  teacher: "",
  room: "",
  note: "",
  format: "campus",
});

export function FlowEditor({ course, entry, meta, onSave, onCancel }) {
  const [name, setName] = useState(entry?.course.name || course.name);
  const [stream, setStream] = useState(entry?.course.stream || "");
  const [source, setSource] = useState(entry?.source || "Введено вручную");
  const [rows, setRows] = useState(
    entry?.slots.map((s) => ({ ...s, weeksText: s.weeks.join(",") })) || [
      blankLesson(),
    ],
  );
  const [error, setError] = useState("");
  const patch = (i, key, value) =>
    setRows((previous) =>
      previous.map((s, index) => (index === i ? { ...s, [key]: value } : s)),
    );
  function submit(event) {
    event.preventDefault();
    setError("");
    try {
      if (!name.trim() || !stream.trim())
        throw new Error("Укажи название предмета и номер или название потока.");
      const id = `manual-${crypto.randomUUID()}`;
      const item = {
        id,
        course: {
          ...course,
          name: name.trim(),
          shortName: course.shortName,
          stream: stream.trim(),
          teachers:
            [
              ...new Set(
                rows.map((s) => s.teacher.trim().split(" ")[0]).filter(Boolean),
              ),
            ].join(" · ") || "Не указан",
        },
        origin: "manual",
        updatedAt: new Date().toISOString(),
        source: source.trim() || "Введено вручную",
        slots: rows.map((s, i) => ({
          id: `${id}-${i}`,
          courseId: course.id,
          kind: s.kind,
          day: Number(s.day),
          start: s.start,
          end: s.end,
          weeks: parseWeeks(s.weeksText),
          teacher: s.teacher.trim() || "-",
          room: s.room.trim() || "-",
          note: s.note.trim() || "-",
          format: s.format,
          stream: stream.trim(),
        })),
      };
      validateCatalog({ schema: 1, entries: [item] }, meta);
      onSave(item);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="flow-editor" aria-label="Редактор потока">
      <div className="builder-section-title">
        <div>
          <span className="eyebrow">СВОЙ ПОТОК</span>
          <h2>{entry ? "Изменить занятия" : "Добавить расписание потока"}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onCancel}
          aria-label="Закрыть редактор"
        >
          <X size={18} />
        </button>
      </div>
      <p className="muted-copy">
        Введи реальные занятия из ИСУ. Номера недель считаются с 31 августа.
        Новая запись попадёт только в черновик и будет доступна в каталоге.
      </p>
      <form onSubmit={submit}>
        <div className="editor-fields">
          <label>
            Предмет
            <input
              required
              maxLength={300}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Поток / уровень
            <input
              required
              maxLength={100}
              placeholder="Например: English B2, поток 4.2"
              value={stream}
              onChange={(e) => setStream(e.target.value)}
            />
          </label>
        </div>
        <label className="editor-source">
          Источник / пояснение
          <input
            maxLength={1000}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </label>
        {rows.map((row, i) => (
          <div className="editor-lesson" key={i}>
            <div className="editor-lesson-top">
              <strong>Занятие {i + 1}</strong>
              <button
                type="button"
                className="text-button danger-text"
                disabled={rows.length === 1}
                onClick={() => setRows(rows.filter((_, index) => index !== i))}
                aria-label={`Удалить занятие ${i + 1}`}
              >
                <Trash2 size={15} /> Удалить
              </button>
            </div>
            <div className="editor-fields four">
              <label>
                День
                <select
                  aria-label={`День занятия ${i + 1}`}
                  value={row.day}
                  onChange={(e) => patch(i, "day", e.target.value)}
                >
                  {DAY_NAMES.map((day, n) => (
                    <option key={day} value={n}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Начало
                <input
                  required
                  aria-label={`Начало занятия ${i + 1}`}
                  type="time"
                  value={row.start}
                  onInput={(e) => patch(i, "start", e.target.value)}
                  onChange={(e) => patch(i, "start", e.target.value)}
                />
              </label>
              <label>
                Окончание
                <input
                  required
                  aria-label={`Окончание занятия ${i + 1}`}
                  type="time"
                  value={row.end}
                  onInput={(e) => patch(i, "end", e.target.value)}
                  onChange={(e) => patch(i, "end", e.target.value)}
                />
              </label>
              <label>
                Тип
                <select
                  value={row.kind}
                  onChange={(e) => patch(i, "kind", e.target.value)}
                >
                  {Object.entries(KIND_NAMES).map(([id, label]) => (
                    <option value={id} key={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Учебные недели
              <input
                required
                aria-label={`Недели занятия ${i + 1}`}
                placeholder="Например: 2,4,6,8 или 1-16"
                value={row.weeksText}
                onChange={(e) => patch(i, "weeksText", e.target.value)}
              />
            </label>
            <div className="week-presets">
              Подставить:
              <button
                type="button"
                onClick={() => patch(i, "weeksText", "1-16")}
              >
                1–16
              </button>
              <button
                type="button"
                onClick={() => patch(i, "weeksText", "1,3,5,7,9,11,13,15")}
              >
                Нечётные 1–15
              </button>
              <button
                type="button"
                onClick={() => patch(i, "weeksText", "2,4,6,8,10,12,14,16")}
              >
                Чётные 2–16
              </button>
            </div>
            <div className="editor-fields">
              <label>
                Преподаватель
                <input
                  maxLength={300}
                  value={row.teacher}
                  onChange={(e) => patch(i, "teacher", e.target.value)}
                  placeholder="Фамилия Имя Отчество"
                />
              </label>
              <label>
                Формат
                <select
                  value={row.format}
                  onChange={(e) => patch(i, "format", e.target.value)}
                >
                  <option value="campus">Очно</option>
                  <option value="video">Онлайн · ВКС</option>
                  <option value="zoom">Онлайн · Zoom</option>
                </select>
              </label>
              <label>
                Аудитория и корпус
                <input
                  maxLength={500}
                  value={row.room}
                  onChange={(e) => patch(i, "room", e.target.value)}
                  placeholder="3302, Ломоносова, 9"
                />
              </label>
              <label>
                Примечание
                <input
                  maxLength={1000}
                  value={row.note}
                  onChange={(e) => patch(i, "note", e.target.value)}
                />
              </label>
            </div>
          </div>
        ))}
        {error && (
          <p className="builder-error" role="alert">
            {error}
          </p>
        )}
        <div className="builder-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setRows([...rows, blankLesson()])}
          >
            <Plus size={16} />
            Ещё занятие
          </button>
          <button className="primary-button" type="submit">
            <Check size={16} />
            Добавить в черновик
          </button>
          <button type="button" className="text-button" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </form>
    </section>
  );
}
