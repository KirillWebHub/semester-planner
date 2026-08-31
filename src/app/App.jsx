import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  getAllEvents,
  initializeWorkspaceProfile,
  LessonModal,
  makeIcs,
} from "../entities/schedule/index.js";
import baseData from "../entities/schedule/model/data/schedule.json";
import catalogData from "../entities/schedule/model/data/catalog.json";
import { ScheduleBuilder } from "../features/schedule-builder/index.js";
import {
  loadIsuCurriculum,
  ProfileSetup,
} from "../features/profile-setup/index.js";
import { useWorkspace } from "../features/workspace/index.js";
import { FlowsPage } from "../pages/flows/index.js";
import { SchedulePage } from "../pages/schedule/index.js";
import { SemesterPage } from "../pages/semester/index.js";
import { AppHeader } from "../widgets/app-header/index.js";
import { AppSidebar } from "../widgets/app-sidebar/index.js";
import { WeekCalendar } from "../widgets/week-calendar/index.js";
import "./styles/index.css";

const initialPage = () =>
  new URLSearchParams(window.location.search).get("page") === "builder"
    ? "builder"
    : "schedule";

function academicYearOptions() {
  const today = new Date();
  const activeStart =
    today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  return Array.from({ length: 7 }, (_, index) => activeStart + 2 - index).map(
    (year) => `${year}/${year + 1}`,
  );
}

export default function App() {
  const testMode =
    new URLSearchParams(window.location.search).get("fresh") === "1";
  const diskPersistence =
    import.meta.env.DEV && import.meta.env.VITE_STORAGE_MODE !== "browser";
  const workspace = useWorkspace(baseData, catalogData, {
    testMode,
    diskPersistence,
  });
  const data = workspace.state.publishedSnapshot || baseData;
  const [page, setPage] = useState(initialPage);
  const [scheduleOptions, setScheduleOptions] = useState({
    week: 1,
    course: "all",
  });
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [toast, setToast] = useState("");
  const syncedProfile = useRef("");
  const allEvents = useMemo(() => getAllEvents(data), [data]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const profile = workspace.state.profile;
    if (!workspace.ready || !profile) return;
    const key = `${profile.academicYear}:${profile.semester}:${profile.group}`;
    if (syncedProfile.current === key) return;
    syncedProfile.current = key;
    workspace.refreshCatalog();
  }, [workspace.ready, workspace.state.profile]);

  function exportSchedule() {
    const url = URL.createObjectURL(
      new Blob([makeIcs(data)], { type: "text/calendar;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    const group = workspace.state.profile.group || "schedule";
    anchor.download = `${group}-${data.meta.year.replace(/\D+/g, "-")}.ics`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("Календарь .ics подготовлен из сохранённого расписания");
  }

  function openSchedule(options = {}) {
    setScheduleOptions({
      week: options.week ?? 1,
      course: options.course ?? "all",
    });
    setPage("schedule");
  }

  function renderPage() {
    if (page === "builder") {
      return (
        <ScheduleBuilder
          workspace={workspace}
          renderCalendar={(props) => <WeekCalendar {...props} />}
          onSelect={setSelectedLesson}
          onPublished={() => {
            openSchedule();
            setToast(
              "Новая версия сохранена. Предыдущая доступна в конструкторе.",
            );
          }}
        />
      );
    }
    if (page === "schedule") {
      return (
        <SchedulePage
          key={`${scheduleOptions.week}:${scheduleOptions.course}`}
          data={data}
          initialWeek={scheduleOptions.week}
          initialCourseFilter={scheduleOptions.course}
          onSelect={setSelectedLesson}
        />
      );
    }
    if (page === "flows") {
      return (
        <FlowsPage
          data={data}
          onCourseClick={(course) => openSchedule({ course })}
        />
      );
    }
    return (
      <SemesterPage
        data={data}
        allEvents={allEvents}
        onWeekClick={(week) => openSchedule({ week })}
      />
    );
  }

  if ((workspace.state.status || "ready") === "onboarding") {
    return (
      <ProfileSetup
        ready={workspace.ready}
        storageStatus={workspace.status}
        testMode={workspace.testMode}
        resolveProfile={loadIsuCurriculum}
        defaults={{
          academicYear: academicYearOptions().find((year) =>
            baseData.meta.year.replaceAll(" ", "").includes(year),
          ),
          academicYears: academicYearOptions(),
          program: "Определится автоматически по группе",
          programs: [
            "Определится автоматически по группе",
            baseData.meta.program,
          ],
          faculty: "Определится по группе",
          semester: baseData.meta.semester,
          semesters: Array.from({ length: 12 }, (_, index) => index + 1),
        }}
        onComplete={(profile) => {
          workspace.update((current) =>
            initializeWorkspaceProfile(current, profile, baseData),
          );
          setPage("builder");
          setToast("Профиль создан. Теперь выбери потоки своего семестра.");
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Перейти к расписанию
      </a>
      <AppSidebar
        activePage={page}
        courseCount={data.courses.length}
        profile={workspace.state.profile}
        onNavigate={setPage}
      />
      <main id="main" className="main-content">
        <AppHeader
          page={page}
          meta={data.meta}
          workspaceStatus={workspace.status}
          onExport={exportSchedule}
        />
        {workspace.error && page !== "builder" && (
          <div className="persistence-warning" role="alert">
            {workspace.error}
            <button className="text-button" onClick={() => setPage("builder")}>
              Открыть конструктор
            </button>
          </div>
        )}
        {renderPage()}
        <footer className="site-footer">
          <span>
            Собрано для {workspace.state.profile.group || "личного профиля"}{" "}
            <span className="footer-dot">·</span> {data.meta.year}
          </span>
          <span>
            Сохранённый личный план. Не подтверждает запись на потоки в ИСУ.
          </span>
        </footer>
      </main>
      {selectedLesson && (
        <LessonModal
          event={selectedLesson}
          onClose={() => setSelectedLesson(null)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
