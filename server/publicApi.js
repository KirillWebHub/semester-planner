import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { fetchIsuCurriculum } from "./isuCurriculum.js";
import { fetchItmoGroupSchedule } from "./itmoSchedule.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sendJson(response, status, value, extraHeaders = {}) {
  response.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Тело запроса слишком большое.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export function createPublicApiServer() {
  return createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, CORS_HEADERS);
      response.end();
      return;
    }

    const url = new URL(request.url || "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        status: "ok",
        service: "semester-planner-api",
        region: process.env.AMVERA ? "amvera" : "local",
      });
      return;
    }

    try {
      if (request.method === "GET" && url.pathname === "/api/isu/curriculum") {
        const value = await fetchIsuCurriculum({
          academicYear: url.searchParams.get("academicYear"),
          group: url.searchParams.get("group"),
          semester: Number(url.searchParams.get("semester")),
        });
        sendJson(response, 200, value, {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/itmo/schedule") {
        const input = await readJson(request);
        const value = await fetchItmoGroupSchedule({
          group: input?.group,
          curriculum: Array.isArray(input?.curriculum)
            ? input.curriculum.slice(0, 100)
            : [],
        });
        sendJson(response, 200, value, {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
        });
        return;
      }

      sendJson(response, 404, { error: "Маршрут не найден." });
    } catch (error) {
      sendJson(response, 422, {
        error:
          error.name === "AbortError" || error.message === "terminated"
            ? "Источник прервал соединение. Попробуй ещё раз."
            : error.message,
      });
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.PORT) || 3000;
  createPublicApiServer().listen(port, "0.0.0.0", () => {
    console.log(`semester-planner-api listening on ${port}`);
  });
}
