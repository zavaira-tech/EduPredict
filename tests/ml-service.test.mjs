import assert from "node:assert/strict";
import test from "node:test";
import { callMlService, isModelType } from "../backend/src/services/mlService.js";

test("ML service supports only declared model types", () => {
  assert.equal(isModelType("performance"), true);
  assert.equal(isModelType("dropout"), true);
  assert.equal(isModelType("course-demand"), true);
  assert.equal(isModelType("courseDemand"), false);
  assert.equal(isModelType("../models"), false);
});

test("ML service reports missing backend credentials explicitly", async () => {
  const previousUrl = process.env.ML_SERVICE_URL;
  const previousKey = process.env.ML_SERVICE_API_KEY;
  delete process.env.ML_SERVICE_URL;
  delete process.env.ML_SERVICE_API_KEY;
  try {
    await assert.rejects(callMlService("/api/ml/models"), (error) => error.status === 503);
  } finally {
    if (previousUrl === undefined) delete process.env.ML_SERVICE_URL;
    else process.env.ML_SERVICE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.ML_SERVICE_API_KEY;
    else process.env.ML_SERVICE_API_KEY = previousKey;
  }
});

test("ML service rejects unsupported protocols", async () => {
  const previousUrl = process.env.ML_SERVICE_URL;
  const previousKey = process.env.ML_SERVICE_API_KEY;
  process.env.ML_SERVICE_URL = "file:///tmp/ml-service";
  process.env.ML_SERVICE_API_KEY = "x".repeat(32);
  try {
    await assert.rejects(callMlService("/api/ml/models"), (error) => error.status === 503);
  } finally {
    if (previousUrl === undefined) delete process.env.ML_SERVICE_URL;
    else process.env.ML_SERVICE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.ML_SERVICE_API_KEY;
    else process.env.ML_SERVICE_API_KEY = previousKey;
  }
});
