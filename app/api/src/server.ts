import cluster from 'node:cluster';
import { config } from './core/config.ts';
import { logger } from './core/logger.ts';

/**
 * Точка входа. При config.workers > 1 — кластер: главный процесс запускает по рабочему процессу
 * на ядро, они делят один порт, упавший процесс перезапускается. Фоновые задачи (проверка сроков,
 * письма) идут только в одном процессе, чтобы не дублировать уведомления и письма.
 */
if (cluster.isPrimary && config.workers > 1) {
  startPrimary(config.workers);
} else {
  await startWorker(cluster.isPrimary || process.env.RUN_JOBS === '1');
}

function startPrimary(count: number) {
  // Запросы раздаются процессам по кругу (на Windows по умолчанию решает ОС и часто грузит один)
  cluster.schedulingPolicy = cluster.SCHED_RR;
  logger.info(`Кластер: ${count} рабочих процессов, порт ${config.port}`);
  let stopping = false;
  const jobWorkers = new Set<number>();

  const fork = (runJobs: boolean) => {
    const worker = cluster.fork({ RUN_JOBS: runJobs ? '1' : '0' });
    if (runJobs) jobWorkers.add(worker.id);
  };

  fork(true);
  for (let i = 1; i < count; i++) fork(false);

  cluster.on('exit', (worker, code, signal) => {
    const hadJobs = jobWorkers.delete(worker.id);
    if (stopping) return;
    logger.error(`Процесс ${worker.process.pid} завершился (${signal ?? code}), запускаю новый`);
    fork(hadJobs);
  });

  const shutdown = () => {
    stopping = true;
    for (const worker of Object.values(cluster.workers ?? {})) worker?.kill('SIGTERM');
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function startWorker(runJobs: boolean) {
  const { createApp } = await import('./app.ts');
  const { prisma } = await import('./core/db.ts');
  const { modules } = await import('./modules/index.ts');

  const server = createApp().listen(config.port);
  let attempts = 0;

  server.on('listening', () => {
    if (cluster.isPrimary) logger.info(`Сервер запущен: http://localhost:${config.port}`);
    else logger.info(`Процесс ${process.pid} готов${runJobs ? ' (фоновые задачи)' : ''}`);
    if (runJobs) for (const module of modules) module.startJobs?.();
  });

  // При перезапуске (node --watch) на Windows старый процесс отпускает порт не сразу — ждём и пробуем снова
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && attempts < 20) {
      attempts += 1;
      setTimeout(() => server.listen(config.port), 250);
      return;
    }
    throw err;
  });

  const shutdown = async () => {
    // Закрываем и keep-alive соединения браузера, иначе порт освобождается с задержкой
    server.close();
    server.closeAllConnections();
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
