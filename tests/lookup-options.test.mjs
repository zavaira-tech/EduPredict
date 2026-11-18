import assert from "node:assert/strict";
import test from "node:test";
import { listLookupOptions } from "../backend/src/controllers/entityController.js";

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("reference lookups reject unknown types and unauthorized roles before querying MongoDB", async () => {
  const unknownResponse = mockResponse();
  await listLookupOptions(
    { params: { type: "unknown" }, user: { role: "admin" }, query: {} },
    unknownResponse,
  );
  assert.equal(unknownResponse.statusCode, 404);

  const restrictedResponse = mockResponse();
  await listLookupOptions(
    { params: { type: "users" }, user: { role: "teacher" }, query: {} },
    restrictedResponse,
  );
  assert.equal(restrictedResponse.statusCode, 403);
});

test("reference lookups reject invalid pagination before querying MongoDB", async () => {
  const response = mockResponse();
  await listLookupOptions(
    { params: { type: "departments" }, user: { role: "admin" }, query: { page: "0" } },
    response,
  );
  assert.equal(response.statusCode, 400);
});

test("academic-record lookups reject malformed reference IDs before querying MongoDB", async () => {
  const response = mockResponse();
  await listLookupOptions(
    {
      params: { type: "academicRecords" },
      user: { role: "admin" },
      query: { studentId: "not-an-object-id", courseId: "also-invalid" },
    },
    response,
  );
  assert.equal(response.statusCode, 400);
});
