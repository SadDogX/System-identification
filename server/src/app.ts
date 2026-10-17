import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.ts';
import { authRouter } from './routes/auth.routes.ts';
import { meRouter } from './routes/me.routes.ts';
import { adminRouter } from './routes/admin.routes.ts';
import { credentialsRouter } from './routes/credentials.routes.ts';
import { errorHandler, notFoundHandler } from './middleware/error.ts';
import { requestLog, securityHeaders } from './middleware/http.ts';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(requestLog);
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/me', meRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/credentials', credentialsRouter);
  app.use('/api', notFoundHandler);

  // Клиент раздаётся этим же сервером — один адрес, без CORS и прокси
  const dist = fileURLToPath(config.clientDist);
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: config.isProduction ? '1h' : 0 }));
    // Любой другой путь — страница приложения, маршрутизацию делает клиент
    app.get('*', (_req, res) => res.sendFile('index.html', { root: dist }));
  }

  app.use(errorHandler);
  return app;
}
