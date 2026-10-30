import { AVATARS, AvatarId } from './types';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ADJ = ['Swift', 'Calm', 'Bold', 'Lucky', 'Quiet', 'Bright', 'Keen', 'Noble'];
const NOUN = ['Eagle', 'Oak', 'Stone', 'River', 'Fox', 'Crown', 'Wolf', 'Star'];

function randomInts(count: number, max: number): number[] {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) {
    return Array.from({ length: count }, () => Math.floor(Math.random() * max));
  }
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const out: number[] = [];
  const buf = new Uint32Array(count * 2);
  while (out.length < count) {
    source.getRandomValues(buf);
    for (const value of buf) {
      if (value < limit && out.length < count) {
        out.push(value % max);
      }
    }
  }
  return out;
}

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function randomId(prefix: string): string {
  return `${prefix}_${randomInts(20, ID_ALPHABET.length)
    .map((n) => ID_ALPHABET[n])
    .join('')}`;
}

export function createRoomCode(taken: Set<string>): string {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = randomInts(4, ALPHABET.length)
      .map((n) => ALPHABET[n] ?? 'A')
      .join('');
    if (!taken.has(code)) {
      return code;
    }
  }
  return `${ALPHABET[0]}${Date.now().toString(36).slice(-3)}`.toUpperCase().slice(0, 4);
}

export function suggestUsername(seed: string): string {
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) {
    n = (n * 33 + seed.charCodeAt(i)) >>> 0;
  }
  const adj = ADJ[n % ADJ.length] ?? 'Swift';
  const noun = NOUN[Math.floor(n / ADJ.length) % NOUN.length] ?? 'Eagle';
  const tail = (n % 90) + 10;
  return `${adj}${noun}${tail}`;
}

export function avatarFor(seed: string): AvatarId {
  let n = 0;
  for (let i = 0; i < seed.length; i += 1) {
    n += seed.charCodeAt(i);
  }
  return AVATARS[n % AVATARS.length] ?? 'gold';
}

export function normalizeUsername(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
}

export function isUsername(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{2,15}$/.test(value);
}
