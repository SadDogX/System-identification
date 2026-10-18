import { createHmac, timingSafeEqual } from 'node:crypto';

// JWT (HS256) на стандартной криптографии Node: header.payload.signature в base64url.

const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function signJwt(payload: object, secret: string, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds })).toString('base64url');
  return `${HEADER}.${body}.${sign(`${HEADER}.${body}`, secret)}`;
}

/** Возвращает payload или null, если подпись неверна, алгоритм не HS256 или срок истёк. */
export function verifyJwt<T>(token: string, secret: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  // Принимаем только свой заголовок — защита от подмены алгоритма (alg: none)
  if (header !== HEADER) return null;

  const expected = Buffer.from(sign(`${header}.${body}`, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload !== 'object' || payload === null) return null;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload as T;
  } catch {
    return null;
  }
}
