import type { RequestHandler, Router } from 'express';
import { authenticate, requirePasswordChanged, requireRole } from './auth.ts';

/**
 * Функциональный модуль системы: свои маршруты API и (необязательно) фоновые задачи.
 * Модули подключаются в app.ts списком — добавить новый модуль = создать папку и вписать его в список.
 */
export interface AppModule {
  name: string;
  routes: { path: string; router: Router }[];
  /** Фоновые задачи. В кластере запускаются только в одном рабочем процессе. */
  startJobs?: () => void;
}

/** Только для вошедших администраторов, сменивших временный пароль. */
export const adminOnly: RequestHandler[] = [authenticate, requirePasswordChanged, requireRole('ADMIN')];

/** Любой вошедший пользователь, сменивший временный пароль. */
export const signedIn: RequestHandler[] = [authenticate, requirePasswordChanged];
