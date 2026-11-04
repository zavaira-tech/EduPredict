import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRisk,
  csvEscape,
  pearsonCorrelation,
  quantile,
} from "../backend/src/utils/analytics.js";

test("Pearson correlation handles positive, negative, and constant samples", () => {
  assert.equal(pearsonCorrelation([[1, 2], [2, 4], [3, 6]]), 1);
  assert.equal(pearsonCorrelation([[1, 6], [2, 4], [3, 2]]), -1);
  assert.equal(pearsonCorrelation([[1, 3], [2, 3]]), null);
  assert.equal(pearsonCorrelation([[1, 2], [Number.NaN, 4]]), null);
});

test("risk classification records transparent factors and thresholds", () => {
  assert.deepEqual(classifyRisk({ attendance: 90, gpa: 3.2, failedCourses: 0, declining: false }), {
    score: 0,
    level: "Low Risk",
    factors: [],
  });
  const high = classifyRisk({ attendance: 70, gpa: 1.8, failedCourses: 2, declining: true });
  assert.equal(high.score, 7);
  assert.equal(high.level, "High Risk");
  assert.equal(high.factors.length, 4);
});

test("quantile interpolates and handles empty data", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
  assert.equal(quantile([], 0.5), null);
});

test("CSV escaping quotes commas and embedded quotes", () => {
  assert.equal(csvEscape('Grade "A", good'), '"Grade ""A"", good"');
  assert.equal(csvEscape(null), '""');
  assert.equal(csvEscape("=HYPERLINK(\"bad\")"), `"'=HYPERLINK(""bad"")"`);
});
