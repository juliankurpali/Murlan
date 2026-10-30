import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const IDENTITY_DOMAIN = 'murlan-identity-v1';
const SESSION_DOMAIN = 'murlan-session-v1';

export function hashIdentity(secret: string): string {
  return createHash('sha256').update(IDENTITY_DOMAIN).update('\0').update(secret).digest('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(SESSION_DOMAIN).update('\0').update(token).digest('hex');
}

export function randomSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function isDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function sameDigest(left: string, right: string): boolean {
  if (!isDigest(left) || !isDigest(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function sameSecret(left: string, right: string): boolean {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}
