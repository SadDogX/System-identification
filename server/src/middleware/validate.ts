import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { badRequest } from '../utils/errors';

export function zodDetails(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    details[key] ??= issue.message;
  }
  return details;
}

/** Валидирует body или query; результат (с отброшенными лишними полями) кладёт обратно. */
export function validate(schema: ZodTypeAny, source: 'body' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(badRequest('Ошибка валидации', zodDetails(result.error)));
    if (source === 'body') req.body = result.data;
    else (req as QueryRequest).validQuery = result.data;
    next();
  };
}

// req.query в Express 4 — геттер, поэтому валидированный query храним отдельно
type QueryRequest = Request & { validQuery: unknown };

export function validQuery<T>(req: Request): T {
  return (req as QueryRequest).validQuery as T;
}

export function idParam(req: Request, name = 'id'): number {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Некорректный идентификатор');
  return id;
}
