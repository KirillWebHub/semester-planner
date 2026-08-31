import { ArrowDownToLine, ChevronRight } from "lucide-react";

const PAGE_COPY = {
  builder: [
    "Конструктор",
    "Выбирай поток и сразу смотри, как меняется неделя.",
  ],
  schedule: ["Расписание", "Пары по местам. Остальное время — твоё."],
  flows: ["Мои потоки", "Предметы и преподаватели выбранного семестра."],
  semester: ["Весь семестр", "От первой пары до последней учебной недели."],
};

export function AppHeader({ page, meta, workspaceStatus, onExport }) {
  const [title, subtitle] = PAGE_COPY[page];
  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          Учёба <ChevronRight size={14} /> <span>{meta.year}</span>
        </div>
        <div className="snapshot">
          <span /> {workspaceStatus}
        </div>
      </header>
      <div className="page-heading">
        <div>
          <div className="heading-kicker">
            <span className="tiny-mark" /> ТВОЙ СЕМЕСТР, ТВОЙ РИТМ
          </div>
          <h1>
            {title}
            <span className="semester-tag">{meta.semester} семестр</span>
          </h1>
          <p>{subtitle}</p>
        </div>
        <button
          className="export-button"
          aria-label="Экспорт .ics"
          onClick={onExport}
        >
          <ArrowDownToLine size={17} />
          <span>Экспорт .ics</span>
        </button>
      </div>
    </>
  );
}
