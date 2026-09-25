export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_SERVER_ERROR", details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request data", fields = {}) {
    super(message, 400, "VALIDATION_ERROR", fields);
    this.fields = fields;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied to the requested resource") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded. Please try again later.", retryAfter = null) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", { retryAfter });
    this.retryAfter = retryAfter;
  }
}

export class AIProviderError extends AppError {
  constructor(message = "AI service temporarily unavailable", statusCode = 502, provider = null) {
    super(message, statusCode, "AI_PROVIDER_ERROR", { provider });
    this.provider = provider;
  }
}

export class ExternalAPIError extends AppError {
  constructor(message = "External API call failed", statusCode = 502, service = null) {
    super(message, statusCode, "EXTERNAL_API_ERROR", { service });
    this.service = service;
  }
}
