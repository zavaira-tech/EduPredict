export function pearsonCorrelation(pairs) {
  const validPairs = pairs.filter(
    ([left, right]) => Number.isFinite(left) && Number.isFinite(right),
  );
  if (validPairs.length < 2) return null;

  const leftMean = validPairs.reduce((sum, [value]) => sum + value, 0) / validPairs.length;
  const rightMean =
    validPairs.reduce((sum, [, value]) => sum + value, 0) / validPairs.length;
  const covariance = validPairs.reduce(
    (sum, [left, right]) => sum + (left - leftMean) * (right - rightMean),
    0,
  );
  const leftVariance = validPairs.reduce(
    (sum, [left]) => sum + (left - leftMean) ** 2,
    0,
  );
  const rightVariance = validPairs.reduce(
    (sum, [, right]) => sum + (right - rightMean) ** 2,
    0,
  );
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator ? Number((covariance / denominator).toFixed(3)) : null;
}

export function classifyRisk({ attendance, gpa, failedCourses, declining }) {
  const factors = [];
  let score = 0;
  if (Number.isFinite(attendance) && attendance < 75) {
    score += 2;
    factors.push(`Attendance is ${attendance.toFixed(1)}% (below 75%).`);
  }
  if (Number.isFinite(gpa) && gpa < 2) {
    score += 2;
    factors.push(`GPA is ${gpa.toFixed(2)} (below 2.00).`);
  }
  if (failedCourses > 0) {
    score += Math.min(2, failedCourses);
    factors.push(`${failedCourses} course${failedCourses === 1 ? "" : "s"} currently have a failing score.`);
  }
  if (declining) {
    score += 1;
    factors.push("Recent performance is below the preceding period.");
  }

  return {
    score,
    level: score >= 4 ? "High Risk" : score >= 2 ? "Medium Risk" : "Low Risk",
    factors,
  };
}

export function quantile(sortedValues, fraction) {
  if (!sortedValues.length) return null;
  const position = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const weight = position - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

export function csvEscape(value) {
  const text = value == null ? "" : String(value);
  const safeText =
    typeof value === "string" && /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}
