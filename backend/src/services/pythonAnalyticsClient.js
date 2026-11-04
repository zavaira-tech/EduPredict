function configuration() {
  const url = process.env.ANALYTICS_SERVICE_URL;
  const apiKey = process.env.ANALYTICS_SERVICE_API_KEY;
  if (!url && !apiKey) return null;
  if (!url || !apiKey) {
    const error = new Error("Both ANALYTICS_SERVICE_URL and ANALYTICS_SERVICE_API_KEY are required.");
    error.status = 500;
    throw error;
  }
  return { url: url.replace(/\/+$/, ""), apiKey };
}

export async function getPythonCorrelation(x, y) {
  const config = configuration();
  if (!config) return null;
  if (x.length < 2 || y.length < 2) return null;
  if (x.length !== y.length) {
    const error = new Error("Correlation inputs must have equal lengths.");
    error.status = 400;
    throw error;
  }
  let response;
  try {
    response = await fetch(`${config.url}/analyze/correlation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Analytics-Key": config.apiKey,
      },
      body: JSON.stringify({ x, y }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    const error = new Error("The configured analytics service is unavailable.");
    error.status = 502;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`The analytics service returned HTTP ${response.status}.`);
    error.status = 502;
    throw error;
  }
  let result;
  try {
    result = await response.json();
  } catch {
    const error = new Error("The analytics service returned an invalid response.");
    error.status = 502;
    throw error;
  }
  if (
    result.method !== "Pearson" ||
    !Number.isInteger(result.sampleSize) ||
    result.sampleSize < 0 ||
    (result.coefficient !== null &&
      (typeof result.coefficient !== "number" ||
        !Number.isFinite(result.coefficient) ||
        result.coefficient < -1 ||
        result.coefficient > 1))
  ) {
    const error = new Error("The analytics service returned an invalid correlation result.");
    error.status = 502;
    throw error;
  }
  return result;
}
