import assert from "node:assert/strict";
import test from "node:test";
import { createPublicApiServer } from "../server/publicApi.js";

test("standalone public API exposes health and CORS endpoints", async (context) => {
  const server = createPublicApiServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  const health = await fetch(`${origin}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    status: "ok",
    service: "semester-planner-api",
    region: "local",
  });

  const preflight = await fetch(`${origin}/api/itmo/schedule`, {
    method: "OPTIONS",
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");

  const missing = await fetch(`${origin}/missing`);
  assert.equal(missing.status, 404);
});
