import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@app/shared';
import { HttpError } from './errors.ts';
import { logger } from './logger.ts';

export function notFoundHandler(_req: Request, res: Response<ApiErrorBody>) {
  res.status(404).json({ error: 'Маршрут не найден' });
}

/** Единый обработчик: наружу уходит только сообщение, без стектрейсов. */
export function errorHandler(err: unknown, req: Request, res: Response<ApiErrorBody>, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({ error: 'Запись с такими данными уже существует' });
  }
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({ error: 'Файл слишком большой (не более 5 МБ)' });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Некорректный JSON' });
  }
  logger.error(`Необработанная ошибка: ${req.method} ${req.path}`, err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}
