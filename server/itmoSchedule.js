import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ITMO_ORIGIN = "https://itmo.ru";
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map();
const execFileAsync = promisify(execFile);

function decodeHtml(value = "") {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function text(value = "") {
  return decodeHtml(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function cell(row, className) {
  return row.match(
    new RegExp(
      `<td\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`,
      "i",
    ),
  )?.[1];
}

function courseKey(value) {
  return text(value)
    .replace(/\((?:лек|прак|лаб)(?:ораторная|тика|ция)?\)\s*$/i, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();
}

function stableId(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function kindFromTitle(title) {
  if (/\((?:лек|лекция)\)/i.test(title)) return "lecture";
  if (/\((?:лаб|лабораторная)\)/i.test(title)) return "lab";
  return "practice";
}

function stripKind(title) {
  return title
    .replace(/\s*\((?:лек|прак|лаб|лекция|практика|лабораторная)\)\s*$/i, "")
    .trim();
}

function parseWeeks(value) {
  const match = value.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}([\s\S]*)/);
  return [...new Set((match?.[1] || "").match(/\d+/g)?.map(Number) || [])]
    .filter((week) => week >= 1 && week <= 26)
    .sort((a, b) => a - b);
}

function curriculumCourse(title, curriculum = []) {
  const key = courseKey(title);
  return curriculum.find((course) => {
    const candidate = courseKey(course.name);
    return (
      candidate === key || candidate.includes(key) || key.includes(candidate)
    );
  });
}

export function parseItmoGroupSchedule(
  html,
  { group, curriculum = [], sourceUrl, fetchedAt = new Date().toISOString() },
) {
  if (/Расписание не найдено/i.test(html)) {
    return {
      status: "not-published",
      message: "ИТМО ещё не опубликовал расписание для этой группы.",
      sourceUrl,
      fetchedAt,
      catalog: { schema: 1, updatedAt: fetchedAt, entries: [] },
    };
  }

  const colors = [
    "violet",
    "rose",
    "blue",
    "amber",
    "cyan",
    "green",
    "indigo",
    "orange",
    "teal",
    "slate",
  ];
  const grouped = new Map();
  for (const tableMatch of html.matchAll(
    /<table\b[^>]*id=["']([1-7])day["'][^>]*>([\s\S]*?)<\/table>/gi,
  )) {
    const day = Number(tableMatch[1]) - 1;
    for (const rowMatch of tableMatch[2].matchAll(
      /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi,
    )) {
      const row = rowMatch[1];
      const timeText = text(cell(row, "time"));
      const lessonHtml = cell(row, "lesson");
      const timeMatch = timeText.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (!timeMatch || !lessonHtml) continue;
      const rawTitle = text(
        lessonHtml.match(/<dd\b[^>]*>([\s\S]*?)<\/dd>/i)?.[1],
      );
      const title = stripKind(rawTitle);
      const weeks = parseWeeks(timeText);
      if (!title || !weeks.length) continue;

      const matched = curriculumCourse(title, curriculum);
      const courseId = matched
        ? `isu-${matched.disciplineId}`
        : `itmo-${stableId(courseKey(title))}`;
      const teacherCells = [
        ...row.matchAll(/<td\b(?![^>]*class=)[^>]*>([\s\S]*?)<\/td>/gi),
      ];
      const teacher = text(teacherCells[0]?.[1]) || "Преподаватель не указан";
      const roomHtml = cell(row, "room") || "";
      const room = [
        text(roomHtml.match(/<dd\b[^>]*>([\s\S]*?)<\/dd>/i)?.[1]),
        text(roomHtml.match(/<dt\b[^>]*>([\s\S]*?)<\/dt>/i)?.[1]),
      ]
        .filter(Boolean)
        .join(", ");
      const formatText = text(cell(row, "lesson-format"));
      const format = /дистанц|онлайн/i.test(formatText) ? "video" : "campus";
      const key = `${courseId}:${group}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          source: `Открытое расписание ИТМО · ${sourceUrl}`,
          updatedAt: fetchedAt,
          origin: "itmo-public",
          course: {
            id: courseId,
            name: matched?.name || title,
            shortName: matched?.name || title,
            stream: group,
            teachers: teacher,
            color: colors[grouped.size % colors.length],
          },
          slots: [],
        });
      }
      const entry = grouped.get(key);
      if (!entry.course.teachers.includes(teacher))
        entry.course.teachers += ` · ${teacher}`;
      entry.slots.push({
        id: `${key}:${day}:${timeMatch[1]}:${weeks.join("-")}:${entry.slots.length}`,
        courseId,
        kind: kindFromTitle(rawTitle),
        day,
        start: timeMatch[1],
        end: timeMatch[2],
        weeks,
        teacher,
        room,
        note: formatText,
        stream: group,
        format,
      });
    }
  }

  const entries = [...grouped.values()];
  return {
    status: entries.length ? "available" : "not-published",
    message: entries.length
      ? `Получено ${entries.length} предметов из открытого расписания ИТМО.`
      : "На странице ИТМО пока нет занятий для этой группы.",
    sourceUrl,
    fetchedAt,
    catalog: { schema: 1, updatedAt: fetchedAt, entries },
  };
}

async function loadHtml(url, fetchImpl) {
  if (process.platform === "win32" && fetchImpl === fetch) {
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); (Invoke-WebRequest -Uri $env:SEMESTER_ITMO_URL -UseBasicParsing -TimeoutSec 25).Content",
        ],
        {
          encoding: "utf8",
          timeout: 30_000,
          maxBuffer: 6_000_000,
          env: { ...process.env, SEMESTER_ITMO_URL: url },
        },
      );
      return stdout;
    } catch {
      throw new Error("Открытое расписание ИТМО временно недоступно.");
    }
  }
  const response = await fetchImpl(url, {
    headers: { Accept: "text/html", "User-Agent": "semester-planner/1.0" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`ИТМО ответил с кодом ${response.status}.`);
  return response.text();
}

export async function fetchItmoGroupSchedule(input, fetchImpl = fetch) {
  const group = String(input.group || "")
    .trim()
    .toUpperCase();
  if (!/^[A-ZА-ЯЁ0-9-]{2,20}$/i.test(group))
    throw new Error("Некорректный номер группы.");
  const key = group;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time < CACHE_TTL) return saved.value;
  const sourceUrl = `${ITMO_ORIGIN}/ru/schedule/0/${encodeURIComponent(group)}/schedule.htm`;
  const html = await loadHtml(sourceUrl, fetchImpl);
  const value = parseItmoGroupSchedule(html, {
    group,
    curriculum: input.curriculum || [],
    sourceUrl,
  });
  cache.set(key, { time: Date.now(), value });
  return value;
}

export function itmoSchedulePlugin() {
  function attach(server) {
    server.middlewares.use("/api/itmo/schedule", async (req, res, next) => {
      if (req.method !== "POST") return next();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "private, max-age=300");
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 1_000_000)
            throw new Error("Запрос слишком большой.");
        }
        const value = await fetchItmoGroupSchedule(JSON.parse(body || "{}"));
        res.end(JSON.stringify(value));
      } catch (error) {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }
  return {
    name: "itmo-public-schedule",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
