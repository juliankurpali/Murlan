import { GameState } from '../domain';

export type VoiceMode = 'natural' | 'clear';

export type AppScreen = 'home' | 'setup' | 'lobby' | 'social' | 'profile' | 'table' | 'rules' | 'settings' | 'handResult';

export type Language = 'en' | 'sq';

export const HUMAN_SEAT = 0 as const;

export type AppSettings = {
  language: Language;
  showLegalMoves: boolean;
  profileUri: string | null;
  sound: boolean;
  music: boolean;
  haptics: boolean;
  voiceMode: VoiceMode;
  handSize: number;
};

export const HAND_SIZE_MIN = 0;
export const HAND_SIZE_MAX = 4;
export const DEFAULT_HAND_SIZE = 2;

export function clampHandSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_HAND_SIZE;
  }
  return Math.max(HAND_SIZE_MIN, Math.min(HAND_SIZE_MAX, Math.round(value)));
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  showLegalMoves: false,
  profileUri: null,
  sound: true,
  music: true,
  haptics: true,
  voiceMode: 'natural',
  handSize: DEFAULT_HAND_SIZE,
};

export type PersistedMatch = {
  schemaVersion: 1;
  state: GameState;
  savedAt: string;
};

export type SessionState = {
  screen: AppScreen;
  settings: AppSettings;
  match: GameState | null;
  selectedIds: string[];
  lastError: string | null;
  confirmNewGame: boolean;
};

export type NewGameOptions = {
  language: Language;
};
