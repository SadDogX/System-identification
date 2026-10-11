import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Переменные из .env.test (отдельная тестовая БД)
    env: loadEnv('test', process.cwd(), ''),
    globalSetup: './tests/globalSetup.ts',
    // Тесты делят одну БД — выполняем файлы последовательно
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
