import { execSync } from 'node:child_process';
import { loadEnv } from 'vite';

/** Пересоздаёт схему тестовой БД перед прогоном. */
export default function setup() {
  const env = loadEnv('test', process.cwd(), '');
  execSync('npx prisma db push --force-reset --skip-generate', {
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
}
