import type { NextFunction, Request, Response } from 'express';
import { config } from './config.ts';
import { logger } from './logger.ts';

/** Базовые заголовки безопасности. */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; frame-src 'self' blob:; object-src 'self' blob:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  if (config.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

/** Одна строка на API-запрос: метод, путь, статус, время. */
export function requestLog(req: Request, res: Response, next: NextFunction) {
  if (config.isTest || !req.path.startsWith('/api/')) return next();
  const started = Date.now();
  res.on('finish', () => logger.info(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started} мс)`));
  next();
}

/** Разбор заголовка Cookie. */
export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

/**
 * Ограничение числа неудачных попыток (в памяти процесса).
 * Успешный запрос не учитывается — считаются только ответы с кодом 4xx.
 */
export function failedAttemptsLimiter(opts: { limit: number; windowMs: number; message: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (entry && entry.resetAt < now) hits.delete(key);
    const current = hits.get(key);
    if (current && current.count >= opts.limit) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: opts.message });
    }
    res.on('finish', () => {
      if (res.statusCode < 400 || res.statusCode >= 500) return;
      const e = hits.get(key) ?? { count: 0, resetAt: Date.now() + opts.windowMs };
      e.count += 1;
      hits.set(key, e);
    });
    next();
  };
}
