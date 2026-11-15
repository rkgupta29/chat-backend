import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/app-error';

declare module 'express-serve-static-core' {
  interface Request {
    validated: { body?: unknown; params?: unknown; query?: unknown };
  }
}

interface Schemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    req.validated = {};
    const issues: { in: string; path: string; message: string }[] = [];

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) {
        req.validated[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ in: part, path: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) {
      return next(AppError.badRequest('Request validation failed', 'VALIDATION_ERROR', issues));
    }
    next();
  };
