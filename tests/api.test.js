import assert from "node:assert/strict";
import test from "node:test";
import curriculumHandler from "../api/isu/curriculum.js";
import scheduleHandler from "../api/itmo/schedule.js";

function responseMock() {
  return {
    headers: {},
    statusCode: 200,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
    json(value) {
      this.body = value;
      this.ended = true;
      return this;
    },
  };
}

test("serverless public endpoints answer CORS preflight without credentials", async () => {
  for (const handler of [curriculumHandler, scheduleHandler]) {
    const response = responseMock();
    await handler({ method: "OPTIONS", query: {} }, response);
    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["Access-Control-Allow-Origin"], "*");
    assert.equal(response.ended, true);
  }
});

test("serverless public endpoints reject unsupported methods", async () => {
  const curriculumResponse = responseMock();
  await curriculumHandler({ method: "DELETE", query: {} }, curriculumResponse);
  assert.equal(curriculumResponse.statusCode, 405);

  const scheduleResponse = responseMock();
  await scheduleHandler({ method: "GET" }, scheduleResponse);
  assert.equal(scheduleResponse.statusCode, 405);
});
