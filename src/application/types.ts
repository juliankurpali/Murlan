import { GameState, MatchMode } from '../domain';

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
};

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  showLegalMoves: false,
  profileUri: null,
  sound: true,
  music: true,
  haptics: true,
  voiceMode: 'natural',
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
  mode: MatchMode;
  language: Language;
};
