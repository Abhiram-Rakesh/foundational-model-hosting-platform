/**
 * src/middleware/errorHandler.js — Global error handler
 *
 * Express calls this when any route calls next(err) or throws.
 * It logs the error and returns a clean JSON response.
 */

function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // Don't leak internal details in production
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500
    ? "Internal server error"
    : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

module.exports = errorHandler;
