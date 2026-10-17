import { config } from '../config.ts';

function write(level: 'info' | 'error', message: string, data?: unknown) {
  if (config.isTest) return;
  const time = new Date().toLocaleTimeString('ru-RU');
  const line = `[${time}] ${message}`;
  if (level === 'error') console.error(line, data ?? '');
  else if (data === undefined) console.log(line);
  else console.log(line, data);
}

export const logger = {
  info: (message: string, data?: unknown) => write('info', message, data),
  error: (message: string, data?: unknown) => write('error', message, data),
};
