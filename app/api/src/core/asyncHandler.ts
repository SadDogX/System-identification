import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 не ловит ошибки async-обработчиков — передаём их в error handler. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
