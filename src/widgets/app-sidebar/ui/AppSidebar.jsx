import {
  ArrowUpRight,
  CalendarDays,
  Grid2X2,
  Layers3,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Brand } from "../../../shared/ui/brand/index.js";

const NAVIGATION = [
  { id: "builder", label: "Конструктор", icon: SlidersHorizontal },
  { id: "schedule", label: "Расписание", icon: CalendarDays },
  { id: "flows", label: "Мои потоки", icon: Layers3 },
  { id: "semester", label: "Весь семестр", icon: Grid2X2 },
];

export function AppSidebar({ activePage, courseCount, profile, onNavigate }) {
  const course = Math.ceil(profile.semester / 2);
  return (
    <aside className="sidebar">
      <Brand />
      <div className="workspace-label">ЛИЧНОЕ ПРОСТРАНСТВО</div>
      <nav aria-label="Главная навигация">
        {NAVIGATION.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={activePage === id ? "nav-item active" : "nav-item"}
            onClick={() => onNavigate(id)}
            aria-label={label}
            aria-current={activePage === id ? "page" : undefined}
          >
            <Icon size={19} />
            <span>{label}</span>
            {id === "flows" ? (
              <span className="nav-count">{courseCount}</span>
            ) : (
              <span className="nav-indicator" />
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-semester">
        <div className="semester-art">
          <span className="art-orbit" />
          <span className="art-number">
            {String(profile.semester).padStart(2, "0")}
          </span>
          <Sparkles size={22} />
        </div>
        <span className="eyebrow">{profile.academicYear}</span>
        <h3>
          Новый семестр,
          <br />
          понятный план.
        </h3>
        <p>
          Все пары, потоки и даты
          <br />в одном месте.
        </p>
        <button onClick={() => onNavigate("semester")}>
          Посмотреть семестр <ArrowUpRight size={16} />
        </button>
      </div>

      <div className="sidebar-bottom">
        <span className="avatar">{profile.group.charAt(0) || "С"}</span>
        <div>
          <strong>{profile.group || "Мой профиль"}</strong>
          <span>
            {profile.faculty || profile.program} · {course} курс
          </span>
        </div>
        <span className="student-dot" />
      </div>
    </aside>
  );
}
