export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = error.status || (error.name === "ValidationError" ? 400 : 500);
  if (error.code === 11000) {
    return res.status(409).json({ success: false, message: "A record with that unique value already exists." });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid value for this record." });
  }
  if (status >= 500) console.error(error);
  const message =
    status >= 500
      ? "Internal server error."
      : error.name === "ValidationError"
        ? "Validation failed."
        : error instanceof SyntaxError && status === 400
          ? "Invalid JSON request body."
          : error.message;
  res.status(status).json({ success: false, message });
}
