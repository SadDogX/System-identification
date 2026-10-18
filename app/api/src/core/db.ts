import { PrismaClient, Prisma } from '@prisma/client';

export const prisma = new PrismaClient();

export type Tx = Prisma.TransactionClient;

/** Пользователь вместе с должностью — так его отдаёт API. */
export const withPosition = { position: true } as const;
export type UserWithPosition = Prisma.UserGetPayload<{ include: typeof withPosition }>;
