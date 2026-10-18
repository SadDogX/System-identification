import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './core/config.ts';
import { errorHandler, notFoundHandler } from './core/error.ts';
import { requestLog, securityHeaders } from './core/http.ts';
import { modules } from './modules/index.ts';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(requestLog);
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, pid: process.pid }));
  for (const module of modules) {
    for (const { path, router } of module.routes) app.use(path, router);
  }
  app.use('/api', notFoundHandler);

  // Клиент (app/web) раздаётся этим же сервером — один адрес, без CORS и прокси
  const dist = fileURLToPath(config.clientDist);
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: config.isProduction ? '1h' : 0 }));
    // Любой другой путь — страница приложения, маршрутизацию делает клиент
    app.get('*', (_req, res) => res.sendFile('index.html', { root: dist }));
  }

  app.use(errorHandler);
  return app;
}
