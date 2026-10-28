export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  console.error(error);
  res.status(error.status || 500).json({
    error: {
      message: error.status ? error.message : "Internal server error",
    },
  });
}
