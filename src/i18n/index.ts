import { Language } from '../application/types';
import { en } from './en';
import { sq } from './sq';

export type MessageKey = keyof typeof en;

const dictionaries: Record<Language, Record<MessageKey, string>> = { en, sq };

export function t(
  language: Language,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text = dictionaries[language][key] ?? dictionaries.en[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function seatName(language: Language, seat: number): string {
  const keys = ['you', 'bot1', 'bot2', 'bot3'] as const;
  const key = keys[seat] ?? 'bot1';
  return t(language, key);
}

const ERROR_KEYS: Record<string, MessageKey> = {
  'username-taken': 'usernameTaken',
  'bad-username': 'badUsername',
  'player-missing': 'playerMissing',
  blocked: 'playerBlocked',
  'not-same-room': 'notSameRoom',
  'rate-limit': 'rateLimited',
  'request-missing': 'requestMissing',
  forbidden: 'tryAgain',
  'room-missing': 'roomMissing',
  'room-full': 'roomFull',
  'room-started': 'roomStarted',
  'not-host': 'notHost',
  'session-expired': 'sessionExpired',
  'seat-taken': 'seatTaken',
  'not-in-room': 'tryAgain',
  'bad-seat': 'seatTaken',
  'seats-not-ready': 'seatsNotReady',
  'players-not-ready': 'playersNotReady',
  auth: 'sessionExpired',
  'bad-device': 'tryAgain',
  replaced: 'replacedSession',
  relayDown: 'relayDown',
};

export function tError(language: Language, error: unknown): string {
  const code = error instanceof Error ? error.message : String(error ?? '');
  const key = ERROR_KEYS[code];
  return key ? t(language, key) : t(language, 'tryAgain');
}
