import { createApp } from './app.ts';
import { config } from './config.ts';
import { prisma } from './db.ts';
import { logger } from './utils/logger.ts';
import { scheduleExpiryCheck } from './jobs/expiryCheck.job.ts';

const app = createApp();
const server = app.listen(config.port);
let attempts = 0;

server.on('listening', () => {
  logger.info(`Сервер запущен: http://localhost:${config.port}`);
  scheduleExpiryCheck();
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

async function shutdown() {
  // Закрываем и keep-alive соединения браузера, иначе порт освобождается с задержкой
  server.close();
  server.closeAllConnections();
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
