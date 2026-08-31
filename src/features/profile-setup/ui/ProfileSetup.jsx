import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarRange,
  Check,
  GraduationCap,
  Users,
} from "lucide-react";
import { Brand } from "../../../shared/ui/brand/index.js";

const STEPS = [
  {
    key: "academicYear",
    eyebrow: "Учебный год",
    title: "С какого семестра начнём?",
    copy: "Каталог и точные учебные недели зависят от выбранного года.",
    icon: CalendarRange,
  },
  {
    key: "program",
    eyebrow: "Направление",
    title: "Что ты изучаешь?",
    copy: "Покажем только предметы и потоки твоего учебного плана.",
    icon: GraduationCap,
  },
  {
    key: "semester",
    eyebrow: "Семестр",
    title: "Выбери текущий семестр",
    copy: "В конструкторе появятся дисциплины именно этого периода.",
    icon: BookOpen,
  },
  {
    key: "group",
    eyebrow: "Учебная группа",
    title: "Остался номер группы",
    copy: "Он нужен для профиля и будущей фильтрации общего расписания.",
    icon: Users,
  },
  {
    key: "done",
    eyebrow: "Всё готово",
    title: "Соберём твоё расписание",
    copy: "Профиль сохранится локально. Теперь можно выбирать потоки.",
    icon: Check,
  },
];

export function ProfileSetup({
  defaults,
  ready,
  storageStatus,
  testMode,
  resolveProfile,
  onComplete,
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(() => ({
    academicYear: defaults.academicYear,
    program: defaults.program,
    semester: defaults.semester,
    group: "",
  }));
  const [groupError, setGroupError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [resolving, setResolving] = useState(false);
  const [curriculum, setCurriculum] = useState(null);
  const current = STEPS[step];
  const Icon = current.icon;
  const normalizedGroup = values.group.trim().toUpperCase();
  const profile = useMemo(
    () => ({
      group: normalizedGroup,
      faculty: curriculum?.faculty || defaults.faculty,
      program: curriculum?.program || values.program,
      academicYear: values.academicYear,
      semester: Number(values.semester),
      ...(curriculum ? { curriculum } : {}),
    }),
    [curriculum, defaults.faculty, normalizedGroup, values],
  );

  async function next() {
    if (current.key === "group") {
      if (!/^[A-ZА-ЯЁ0-9-]{2,20}$/i.test(normalizedGroup)) {
        setGroupError("Укажи группу буквами и цифрами, например N3347.");
        return;
      }
      setGroupError("");
      if (resolveProfile) {
        setResolving(true);
        setLookupError("");
        try {
          setCurriculum(await resolveProfile(profile));
        } catch (error) {
          setLookupError(error.message);
          setResolving(false);
          return;
        }
        setResolving(false);
      }
    }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  }

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <Brand />
        <div className="onboarding-status">
          <span />
          {testMode ? "Безопасный тестовый профиль" : storageStatus}
        </div>
      </header>

      <section className="onboarding-card" aria-labelledby="setup-title">
        <div className="onboarding-progress" aria-label="Шаг настройки">
          {STEPS.map((item, index) => (
            <span key={item.key} className={index <= step ? "active" : ""} />
          ))}
        </div>

        <div className="onboarding-step-count">
          ШАГ {String(step + 1).padStart(2, "0")} / 05
        </div>
        <div className="onboarding-icon">
          <Icon size={28} />
        </div>
        <span className="eyebrow">{current.eyebrow}</span>
        <h1 id="setup-title">{current.title}</h1>
        <p className="onboarding-copy">{current.copy}</p>

        <div className="onboarding-control">
          {current.key === "academicYear" && (
            <label>
              Учебный год
              <select
                value={values.academicYear}
                onChange={(event) =>
                  setValues({ ...values, academicYear: event.target.value })
                }
              >
                {defaults.academicYears.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </label>
          )}

          {current.key === "program" && (
            <label>
              Направление подготовки
              <select
                value={values.program}
                onChange={(event) =>
                  setValues({ ...values, program: event.target.value })
                }
              >
                {defaults.programs.map((program) => (
                  <option key={program}>{program}</option>
                ))}
              </select>
              <small>{defaults.faculty}</small>
            </label>
          )}

          {current.key === "semester" && (
            <div className="semester-choice" role="radiogroup">
              {defaults.semesters.map((semester) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={Number(values.semester) === semester}
                  className={
                    Number(values.semester) === semester ? "selected" : ""
                  }
                  key={semester}
                  onClick={() => setValues({ ...values, semester })}
                >
                  <strong>{semester}</strong>
                  <span>семестр</span>
                </button>
              ))}
            </div>
          )}

          {current.key === "group" && (
            <label>
              Номер группы
              <input
                autoFocus
                value={values.group}
                placeholder="Например, N3347"
                maxLength={20}
                aria-invalid={Boolean(groupError)}
                aria-describedby={groupError ? "group-error" : undefined}
                onChange={(event) => {
                  setValues({ ...values, group: event.target.value });
                  setGroupError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") next();
                }}
              />
              {groupError && (
                <small id="group-error" className="field-error" role="alert">
                  {groupError}
                </small>
              )}
              {lookupError && (
                <div className="lookup-warning" role="alert">
                  <small>{lookupError}</small>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setStep(STEPS.length - 1)}
                  >
                    Продолжить без синхронизации
                  </button>
                </div>
              )}
            </label>
          )}

          {current.key === "done" && (
            <dl className="profile-summary">
              <div>
                <dt>Группа</dt>
                <dd>{profile.group}</dd>
              </div>
              <div>
                <dt>Направление</dt>
                <dd>{profile.program}</dd>
              </div>
              <div>
                <dt>Период</dt>
                <dd>
                  {profile.semester} семестр · {profile.academicYear}
                </dd>
              </div>
              {curriculum && (
                <div>
                  <dt>Открытый план ИСУ</dt>
                  <dd>
                    № {curriculum.planId} · {curriculum.courses.length}{" "}
                    дисциплин
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="onboarding-actions">
          <button
            type="button"
            className="text-button"
            disabled={step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
          >
            <ArrowLeft size={17} />
            Назад
          </button>
          {current.key === "done" ? (
            <button
              type="button"
              className="primary-button"
              disabled={!ready}
              onClick={() => onComplete(profile)}
            >
              Перейти в конструктор
              <ArrowRight size={17} />
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={resolving}
              onClick={next}
            >
              {resolving ? "Ищем план в ИСУ…" : "Продолжить"}
              <ArrowRight size={17} />
            </button>
          )}
        </div>
      </section>

      <p className="onboarding-footnote">
        Данные остаются в этом браузере. Пароль и доступ к ITMO.ID не нужны.
      </p>
    </main>
  );
}
