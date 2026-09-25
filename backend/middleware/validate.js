import { ValidationError } from "../utils/errors.js";

export const validate = (schemas) => (req, res, next) => {
  const errors = {};

  if (schemas.body) {
    const result = schemas.body.safeParse(req.body);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") || "body";
        errors[path] = issue.message;
      }
    } else {
      req.body = result.data;
    }
  }

  if (schemas.query) {
    const result = schemas.query.safeParse(req.query);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") || "query";
        errors[path] = issue.message;
      }
    } else {
      req.query = result.data;
    }
  }

  if (schemas.params) {
    const result = schemas.params.safeParse(req.params);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") || "params";
        errors[path] = issue.message;
      }
    } else {
      req.params = result.data;
    }
  }

  if (Object.keys(errors).length > 0) {
    return next(new ValidationError("Request validation failed", errors));
  }

  next();
};

export default validate;
