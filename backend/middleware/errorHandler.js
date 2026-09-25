import { logger } from "../utils/logger.js";
import { AppError } from "../utils/errors.js";

export const errorHandler = (err, req, res, next) => {
  const reqId = req.id || "unknown";

  // Handle Payload Too Large
  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({
      success: false,
      error: "Payload too large. Request body exceeds the maximum permitted limit.",
      code: "PAYLOAD_TOO_LARGE",
      requestId: reqId,
    });
  }

  // Handle Mongoose Validation Error
  if (err.name === "ValidationError" && err.errors) {
    const fields = {};
    for (const [key, val] of Object.entries(err.errors)) {
      fields[key] = val.message;
    }
    return res.status(400).json({
      success: false,
      error: "Database validation failed",
      code: "VALIDATION_ERROR",
      fields,
      requestId: reqId,
    });
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      error: `Invalid resource identifier: ${err.value}`,
      code: "INVALID_ID",
      requestId: reqId,
    });
  }

  // Handle Known AppError
  if (err instanceof AppError) {
    logger.warn(`[${req.method} ${req.url}] ${err.code}: ${err.message}`, {
      requestId: reqId,
      statusCode: err.statusCode,
      code: err.code,
      userId: req.uid,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      fields: err.fields || undefined,
      details: err.details || undefined,
      requestId: reqId,
    });
  }

  // Handle Uncaught / Unknown Internal Errors
  logger.error(`[UNHANDLED ERROR] [${req.method} ${req.url}] ${err.message}`, {
    requestId: reqId,
    stack: err.stack,
    userId: req.uid,
  });

  const isProduction = process.env.NODE_ENV === "production";
  return res.status(500).json({
    success: false,
    error: isProduction ? "An unexpected internal server error occurred" : err.message,
    code: "INTERNAL_SERVER_ERROR",
    requestId: reqId,
  });
};

export default errorHandler;
