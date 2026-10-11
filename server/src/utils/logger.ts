import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.isTest ? 'silent' : 'info',
  transport: config.isProduction || config.isTest ? undefined : { target: 'pino-pretty' },
});
