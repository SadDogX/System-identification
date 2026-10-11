import { createApp } from './app';
import { config } from './config';
import { prisma } from './db';
import { logger } from './utils/logger';
import { scheduleExpiryCheck } from './jobs/expiryCheck.job';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(`Сервер запущен: http://localhost:${config.port}`);
  scheduleExpiryCheck();
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
