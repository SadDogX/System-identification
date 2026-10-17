import type { NextFunction, Request, Response } from 'express';
import { parse, type Validator } from '@app/shared';
import { badRequest } from '../utils/errors.ts';

// req.query в Express — геттер, поэтому проверенный query храним отдельно
type QueryRequest = Request & { validQuery: unknown };

/** Проверяет body или query; результат (с отброшенными лишними полями) кладёт обратно. */
export function validate<T>(schema: Validator<T>, source: 'body' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = parse(schema, req[source] ?? {});
    if (!result.ok) return next(badRequest('Ошибка валидации', result.issues));
    if (source === 'body') req.body = result.value;
    else (req as QueryRequest).validQuery = result.value;
    next();
  };
}

export function validQuery<T>(req: Request): T {
  return (req as QueryRequest).validQuery as T;
}

export function idParam(req: Request, name = 'id'): number {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Некорректный идентификатор');
  return id;
}
