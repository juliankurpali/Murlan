import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, clampHandSize, DEFAULT_SETTINGS, PersistedMatch } from '../application/types';
import { GameState } from '../domain';
import { MATCH_STORAGE_KEY, SETTINGS_STORAGE_KEY } from './keys';
import { clearProfilePhoto, loadProfilePhoto } from './profilePhoto';

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<GameState>;
  return (
    record.schemaVersion === 1 &&
    Array.isArray(record.hands) &&
    (record.hands.length === 4 || record.hands.length === 6) &&
    typeof record.mode === 'string' &&
    typeof record.phase === 'string'
  );
}

export async function saveMatch(state: GameState): Promise<void> {
  const payload: PersistedMatch = {
    schemaVersion: 1,
    state,
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(payload));
}

export async function loadMatch(): Promise<GameState | null> {
  const raw = await AsyncStorage.getItem(MATCH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedMatch>;
    if (parsed.schemaVersion !== 1 || !isGameState(parsed.state)) {
      return null;
    }
    return {
      ...parsed.state,
      lastExchange: parsed.state.lastExchange ?? null,
      pendingExchange: parsed.state.pendingExchange ?? null,
    };
  } catch {
    return null;
  }
}

export async function clearMatch(): Promise<void> {
  await AsyncStorage.removeItem(MATCH_STORAGE_KEY);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (!settings.profileUri) {
    await clearProfilePhoto();
  }
  const { profileUri: _photo, ...rest } = settings;
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(rest));
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
  const photo = await loadProfilePhoto();
  if (!raw) {
    return { ...DEFAULT_SETTINGS, profileUri: photo };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      language: parsed.language === 'sq' ? 'sq' : 'en',
      showLegalMoves: Boolean(parsed.showLegalMoves),
      profileUri: photo,
      sound: parsed.sound !== false,
      music: parsed.music !== false,
      haptics: parsed.haptics !== false,
      voiceMode: parsed.voiceMode === 'clear' ? 'clear' : 'natural',
      handSize: clampHandSize(parsed.handSize),
    };
  } catch {
    return { ...DEFAULT_SETTINGS, profileUri: photo };
  }
}
