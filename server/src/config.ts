function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4100),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test' || process.env.VITEST === 'true',
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlDays: 7,
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5180',
};
