import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validateWorkspace } from "../src/entities/schedule/model/index.js";

export function workspaceStore(directory) {
  const file = path.join(directory, "workspace.json");
  let queue = Promise.resolve();
  async function read() {
    let damaged = false;
    for (const candidate of [file, `${file}.backup`]) {
      try {
        const record = JSON.parse(await readFile(candidate, "utf8"));
        validateWorkspace(record.state);
        if (!Number.isInteger(record.revision) || record.revision < 1)
          throw new Error("revision");
        return { ...record, recovered: damaged };
      } catch (error) {
        if (error.code !== "ENOENT") damaged = true;
      }
    }
    if (damaged)
      throw new Error(
        "Файл расписания повреждён. Он не будет перезаписан автоматически. Восстанови workspace.json из своей JSON-копии.",
      );
    return { revision: 0, state: null };
  }
  function save(state, revision) {
    const operation = queue.then(async () => {
      validateWorkspace(state);
      const old = await read();
      if (old.revision !== revision) {
        const e = new Error(
          "На диске уже есть другая версия. Сначала синхронизируй изменения.",
        );
        e.status = 409;
        throw e;
      }
      await mkdir(directory, { recursive: true });
      const record = {
        revision: old.revision + 1,
        savedAt: new Date().toISOString(),
        state,
      };
      if (old.state)
        await writeFile(`${file}.backup`, JSON.stringify(old, null, 2), "utf8");
      const tmp = `${file}.${randomUUID()}.tmp`;
      await writeFile(tmp, JSON.stringify(record, null, 2), "utf8");
      await rename(tmp, file);
      return record;
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return { read, save };
}

export function persistencePlugin() {
  const store = workspaceStore(
    path.resolve(process.env.SEMESTER_DATA_DIR || "user-data"),
  );
  function attach(server) {
    server.middlewares.use("/api/workspace", async (req, res, next) => {
      if (req.url !== "/" && req.url !== "") return next();
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      try {
        // Mutations are accepted only from this local app, not arbitrary websites.
        if (
          req.headers.origin &&
          req.headers.origin !== `http://${req.headers.host}`
        ) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: "Чужой источник запроса." }));
          return;
        }
        if (req.method === "GET") {
          res.end(JSON.stringify(await store.read()));
          return;
        }
        if (req.method !== "PUT") {
          res.statusCode = 405;
          res.end("{}");
          return;
        }
        if (!req.headers["content-type"]?.startsWith("application/json")) {
          res.statusCode = 415;
          res.end("{}");
          return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 5_000_000) {
            res.statusCode = 413;
            res.end(JSON.stringify({ error: "Файл больше 5 МБ." }));
            return;
          }
          chunks.push(chunk);
        }
        const { state, revision } = JSON.parse(
          Buffer.concat(chunks).toString("utf8"),
        );
        res.end(JSON.stringify(await store.save(state, revision)));
      } catch (error) {
        res.statusCode = error.status || 400;
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }
  return {
    name: "local-schedule-storage",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
