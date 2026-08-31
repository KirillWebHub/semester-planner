export const DAY_NAMES = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];
export const DAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const KIND_NAMES = {
  lecture: "Лекция",
  lab: "Лабораторная",
  practice: "Практика",
};
export const toMinutes = (time) =>
  time.split(":").reduce((total, part) => total * 60 + Number(part), 0);

export function addDays(date, count) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + count);
  return result.toISOString().slice(0, 10);
}

export function weekDate(data, week, day = 0) {
  return addDays(data.meta.startDate, (week - 1) * 7 + day);
}

export function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${date}T12:00:00Z`));
}

export function weekRange(data, week) {
  return `${formatDate(weekDate(data, week))} — ${formatDate(weekDate(data, week, 6))}`;
}

export function getWeekEvents(data, week) {
  return data.slots
    .filter((slot) => slot.weeks.includes(week))
    .map((slot) => ({
      ...slot,
      course: data.courses.find((course) => course.id === slot.courseId),
      date: weekDate(data, week, slot.day),
      week,
      occurrenceId: `${slot.id}-${week}`,
    }))
    .sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start));
}

export function getAllEvents(data) {
  return Array.from({ length: data.meta.weekCount }, (_, index) =>
    getWeekEvents(data, index + 1),
  ).flat();
}

export function getMetrics(events) {
  const days = new Map();
  for (const event of events) {
    if (!days.has(event.date)) days.set(event.date, []);
    days.get(event.date).push(event);
  }
  let maxPairs = 0;
  let bigGaps = 0;
  for (const list of days.values()) {
    list.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    maxPairs = Math.max(maxPairs, list.length);
    for (let i = 1; i < list.length; i++) {
      if (toMinutes(list[i].start) - toMinutes(list[i - 1].end) > 40) bigGaps++;
    }
  }
  return {
    pairs: events.length,
    days: days.size,
    maxPairs,
    bigGaps,
    late: events.filter((event) => toMinutes(event.end) > 20 * 60 + 20).length,
    academicHours: events.length * 2,
  };
}

export function findConflicts(events) {
  const result = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i],
        b = events[j];
      if (
        a.date === b.date &&
        toMinutes(a.start) < toMinutes(b.end) &&
        toMinutes(b.start) < toMinutes(a.end)
      ) {
        result.push([a, b]);
      }
    }
  }
  return result;
}

// Interval partitioning: simultaneous lessons get separate lanes, including chained overlaps.
export function layoutEvents(events) {
  const result = new Map();
  const conflicts = new Map(events.map((e) => [e.occurrenceId, []]));
  for (const [a, b] of findConflicts(events)) {
    conflicts.get(a.occurrenceId).push(b);
    conflicts.get(b.occurrenceId).push(a);
  }
  for (const date of new Set(events.map((e) => e.date))) {
    const sorted = events
      .filter((e) => e.date === date)
      .sort(
        (a, b) =>
          toMinutes(a.start) - toMinutes(b.start) ||
          toMinutes(b.end) - toMinutes(a.end),
      );
    let cluster = [],
      end = -1;
    function flush() {
      const lanes = [];
      for (const e of cluster) {
        let lane = lanes.findIndex((until) => until <= toMinutes(e.start));
        if (lane === -1) lane = lanes.length;
        lanes[lane] = toMinutes(e.end);
        result.set(e.occurrenceId, {
          lane,
          conflicts: conflicts.get(e.occurrenceId),
        });
      }
      for (const e of cluster) result.get(e.occurrenceId).lanes = lanes.length;
      cluster = [];
    }
    for (const e of sorted) {
      if (toMinutes(e.start) >= end) flush();
      cluster.push(e);
      end = Math.max(cluster.length === 1 ? -1 : end, toMinutes(e.end));
    }
    flush();
  }
  return result;
}

export function shortTeacher(teacher) {
  if (!teacher || teacher === "-") return "Преподаватель не указан";
  const [surname, ...rest] = teacher.split(" ");
  return `${surname} ${rest.map((word) => `${word[0]}.`).join("")}`;
}

export function locationLabel(event) {
  if (event.format === "video") return "Онлайн · ВКС";
  if (event.format === "zoom") return "Онлайн · Zoom";
  const number = event.room.split(",")[0];
  const room =
    number === "-" ? event.note.match(/\b\d{3,4}\b/)?.[0] || "" : number;
  const campus = event.room.includes("Песочная")
    ? "Песочная"
    : event.room.includes("Гривцова")
      ? "Гривцова"
      : event.room.includes("Чайковского")
        ? "Чайковского"
        : event.room.includes("Ломоносова")
          ? "Ломоносова"
          : "Аудитория";
  return `${campus}${room ? ` · ${room}` : ""}`;
}

const escapeIcs = (text) =>
  String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

// RFC 5545: fold lines at 75 UTF-8 octets, without splitting a code point.
export function foldIcsLine(line) {
  const encoder = new TextEncoder();
  const lines = [];
  let current = "",
    size = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (size + length > 75) {
      lines.push(current);
      current = " ";
      size = 1;
    }
    current += character;
    size += length;
  }
  lines.push(current);
  return lines.join("\r\n");
}

export function makeIcs(data, events = getAllEvents(data)) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const utcTime = (date, time) =>
    new Date(`${date}T${time.padStart(5, "0")}:00+03:00`)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Semester N3347//Schedule//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Семестр N3347 — осень 2026",
    "X-WR-TIMEZONE:Europe/Moscow",
  ];
  for (const event of events) {
    const teacher =
      event.teacher === "-" ? "Преподаватель не указан" : event.teacher;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.occurrenceId}@semester-planner.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utcTime(event.date, event.start)}`,
      `DTEND:${utcTime(event.date, event.end)}`,
      `SUMMARY:${escapeIcs(`${event.course.shortName} · ${KIND_NAMES[event.kind]}`)}`,
      `LOCATION:${escapeIcs(event.format === "campus" ? event.room : locationLabel(event))}`,
      `DESCRIPTION:${escapeIcs(`${event.course.name}\n${teacher}\nПоток: ${event.stream}\nПримечание: ${event.note}\nУчебная неделя: ${event.week}\nСохранённый личный план. Не подтверждает запись на поток в ИСУ.`)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
