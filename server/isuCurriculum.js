import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ISU_ORIGIN = "https://isu.ifmo.ru";
const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map();
const execFileAsync = promisify(execFile);

function decodeHtml(value) {
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

function plainText(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function cells(row) {
  return [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
    plainText(match[1]),
  );
}

function exactGroup(text, group) {
  return new RegExp(`(?:^|[\\s,])${group}(?:$|[\\s,])`, "i").test(text);
}

export function parsePlanCandidates(html, group) {
  const result = [];
  for (const match of html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const row = match[0];
    if (!row.includes("EP_UCHEB_PLAN")) continue;
    const values = cells(row);
    if (values.length < 9 || !exactGroup(values[1], group)) continue;
    const href = row.match(/href="([^"]*EP_UCHEB_PLAN[^"]*)"/i)?.[1];
    const planId = values[5];
    if (!href || !/^\d+$/.test(planId)) continue;
    const program = values[1].replace(/\s+Группы:[\s\S]*$/i, "").trim();
    result.push({
      faculty: values[0].replace(/^\[\d+\]\s*/, ""),
      program,
      course: Number(values[2]),
      qualification: values[3],
      studyMode: values[4],
      planId,
      kind: values[7],
      url: decodeHtml(href),
    });
  }
  return result;
}

export function parseSemesterCourses(html, semester) {
  const marker = `>${semester} семестр<`;
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const next = html.indexOf(`>${Number(semester) + 1} семестр<`, start);
  const section = html.slice(start, next < 0 ? undefined : next);
  const result = [];
  for (const match of section.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const values = cells(match[0]);
    if (values.length < 13 || !/^\d+$/.test(values[2])) continue;
    result.push({
      module: values[0],
      name: values[1],
      disciplineId: values[2],
      department: values[4],
      hours: {
        lectures: Number(values[5]) || 0,
        labs: Number(values[6]) || 0,
        practice: Number(values[7]) || 0,
        selfStudy: Number(values[9]) || 0,
      },
      assessment: values[10],
      selectable: values[11].toLowerCase() === "да",
    });
  }
  return result;
}

function validateInput({ academicYear, group, semester }) {
  if (!/^20\d{2}\/20\d{2}$/.test(academicYear))
    throw new Error("Некорректный учебный год.");
  if (!/^[A-ZА-ЯЁ0-9-]{2,20}$/i.test(group))
    throw new Error("Некорректный номер группы.");
  if (!Number.isInteger(semester) || semester < 1 || semester > 12)
    throw new Error("Некорректный семестр.");
}

async function loadHtml(url, fetchImpl) {
  // The local Windows network stack can reach ISU through WinINET even when
  // Node's direct socket is filtered. Production runtimes use regular fetch.
  if (process.platform === "win32" && fetchImpl === fetch) {
    let stdout;
    try {
      ({ stdout } = await execFileAsync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); (Invoke-WebRequest -Uri $env:SEMESTER_ISU_URL -UseBasicParsing -TimeoutSec 35).Content",
        ],
        {
          encoding: "utf8",
          timeout: 40_000,
          maxBuffer: 9_000_000,
          env: { ...process.env, SEMESTER_ISU_URL: url },
        },
      ));
    } catch {
      throw new Error("ИСУ временно не отвечает. Попробуй ещё раз.");
    }
    if (stdout.length > 8_000_000)
      throw new Error("Ответ ИСУ слишком большой.");
    return stdout;
  }
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "text/html", "User-Agent": "semester-planner/1.0" },
      signal: AbortSignal.timeout(110_000),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      throw new Error("ИСУ не ответила за 110 секунд. Попробуй ещё раз.");
    throw new Error("Не удалось подключиться к открытой странице ИСУ.");
  }
  if (!response.ok) throw new Error(`ИСУ ответила с кодом ${response.status}.`);
  const html = await response.text();
  if (html.length > 8_000_000) throw new Error("Ответ ИСУ слишком большой.");
  return html;
}

export async function fetchIsuCurriculum(input, fetchImpl = fetch) {
  const academicYear = String(input.academicYear || "").replace(/[^\d/]/g, "");
  const group = String(input.group || "")
    .trim()
    .toUpperCase();
  const semester = Number(input.semester);
  validateInput({ academicYear, group, semester });
  const key = `${academicYear}:${group}:${semester}`;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time < CACHE_TTL) return saved.value;

  const params = `${encodeURIComponent(academicYear)},${encodeURIComponent(group)}`;
  const directoryUrl = `${ISU_ORIGIN}/pls/apex/f?p=2143:PLANS:::::EP_UCHEB_YEAR,EP_GROUP:${params}`;
  const directory = await loadHtml(directoryUrl, fetchImpl);
  const candidates = parsePlanCandidates(directory, group);
  const plan = candidates.find((item) =>
    item.kind.toLowerCase().startsWith("базов"),
  );
  if (!plan)
    throw new Error(
      `Для группы ${group} не найден базовый учебный план ${academicYear}.`,
    );

  // APEX embeds a short-lived session id in row links. Build an equivalent
  // public URL without that session so cached directory pages remain usable.
  const planUrl = `${ISU_ORIGIN}/pls/apex/f?p=2143:13:::::EP_UCHEB_YEAR,EP_MEGAFACULTY,EP_FACULTY,EP_CATHEDRA,EP_GROUP,EP_FO,EP_KVAL,EP_UCHEB_PLAN:${encodeURIComponent(academicYear)},-1,-1,,${encodeURIComponent(group)},-1,-1,${plan.planId}`;
  const planPage = await loadHtml(planUrl, fetchImpl);
  const courses = parseSemesterCourses(planPage, semester);
  if (!courses.length)
    throw new Error(
      `В плане ${plan.planId} нет дисциплин ${semester} семестра.`,
    );

  const value = {
    source: "ИСУ ИТМО · открытый учебный план",
    fetchedAt: new Date().toISOString(),
    academicYear,
    semester,
    group,
    faculty: plan.faculty,
    program: plan.program,
    planId: plan.planId,
    planUrl,
    courses,
  };
  cache.set(key, { time: Date.now(), value });
  return value;
}

export function isuCurriculumPlugin() {
  function attach(server) {
    server.middlewares.use("/api/isu/curriculum", async (req, res, next) => {
      if (req.method !== "GET") return next();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "private, max-age=300");
      try {
        const url = new URL(req.url, "http://localhost");
        const value = await fetchIsuCurriculum({
          academicYear: url.searchParams.get("academicYear"),
          group: url.searchParams.get("group"),
          semester: Number(url.searchParams.get("semester")),
        });
        res.end(JSON.stringify(value));
      } catch (error) {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }
  return {
    name: "isu-public-curriculum",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
