import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const databaseUrl = new URL(process.env.DATABASE_URL!);
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.slice(1),
  connectionLimit: Number(databaseUrl.searchParams.get('connection_limit') || 10),
});

export const prisma = new PrismaClient({ adapter });

export type Tx = Prisma.TransactionClient;

/** Пользователь вместе с должностью — так его отдаёт API. */
export const withPosition = {
  position: true,
  systemRoles: {
    where: { revokedAt: null, systemRole: { isActive: true } },
    include: { systemRole: { select: { code: true } } },
  },
} as const;
export type UserWithPosition = Prisma.UserGetPayload<{ include: typeof withPosition }>;
