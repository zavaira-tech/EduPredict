const modelTypes = new Set(["performance", "dropout", "course-demand"]);

function serviceConfiguration() {
  const baseUrl = process.env.ML_SERVICE_URL?.trim();
  const apiKey = process.env.ML_SERVICE_API_KEY;
  if (!baseUrl || !apiKey || apiKey.length < 32) {
    const error = new Error("The machine-learning service is not configured.");
    error.status = 503;
    throw error;
  }
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    const error = new Error("The machine-learning service URL is invalid.");
    error.status = 503;
    throw error;
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    const error = new Error("The machine-learning service URL must use HTTP or HTTPS.");
    error.status = 503;
    throw error;
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (url.protocol === "http:" && !loopbackHosts.has(url.hostname)) {
    const error = new Error("The machine-learning service must use HTTPS outside the local machine.");
    error.status = 503;
    throw error;
  }
  if (url.username || url.password) {
    const error = new Error("Credentials must not be embedded in the machine-learning service URL.");
    error.status = 503;
    throw error;
  }
  return { baseUrl: url.toString().replace(/\/$/, ""), apiKey };
}

export async function callMlService(path, { method = "GET", body, timeoutMs = 15_000 } = {}) {
  const { baseUrl, apiKey } = serviceConfiguration();
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "X-ML-Service-Key": apiKey,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (requestError) {
    const error = new Error(
      requestError.name === "TimeoutError"
        ? "The machine-learning service request timed out."
        : "The machine-learning service is unavailable.",
    );
    error.status = requestError.name === "TimeoutError" ? 504 : 503;
    throw error;
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    const error = new Error("The machine-learning service returned an invalid response.");
    error.status = 502;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(
      typeof payload.detail === "string"
        ? payload.detail
        : "The machine-learning service could not complete the request.",
    );
    error.status = response.status === 422 ? 422 : response.status === 409 ? 409 : 502;
    throw error;
  }
  if (payload?.success !== true) {
    const error = new Error("The machine-learning service returned an unexpected response.");
    error.status = 502;
    throw error;
  }
  return payload.data;
}

export function isModelType(value) {
  return modelTypes.has(value);
}
