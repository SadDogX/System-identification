import type { AppModule } from '../core/module.ts';
import { authModule } from './auth/index.ts';
import { usersModule } from './users/index.ts';
import { credentialsModule } from './credentials/index.ts';
import { catalogModule } from './catalog/index.ts';
import { positionsModule } from './positions/index.ts';
import { notificationsModule } from './notifications/index.ts';
import { messagesModule } from './messages/index.ts';
import { dashboardModule } from './dashboard/index.ts';
import { overviewModule } from './overview/index.ts';
import { auditModule } from './audit/index.ts';

/** Все функциональные модули системы. Новый модуль — новая папка и строка здесь. */
export const modules: AppModule[] = [
  authModule,
  usersModule,
  credentialsModule,
  catalogModule,
  positionsModule,
  notificationsModule,
  messagesModule,
  dashboardModule,
  overviewModule,
  auditModule,
];
