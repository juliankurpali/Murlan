import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGAL_ACCEPT_STORAGE, TABLE_SESSION_STORAGE, USERNAME_PROMPT_STORAGE } from './keys';

export type TableSession = {
  gameId: string;
  parked?: boolean;
};

export type { AuthSession } from './identity';
export { loadIdentitySecret as loadPlayerKey, loadSecureAuth as loadAuth, saveSecureAuth as saveAuth } from './identity';

export async function loadTableSession(): Promise<TableSession | null> {
  const raw = await AsyncStorage.getItem(TABLE_SESSION_STORAGE);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TableSession>;
    if (typeof parsed.gameId === 'string' && parsed.gameId.length > 4) {
      return { gameId: parsed.gameId, parked: parsed.parked === true };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveTableSession(session: TableSession | null): Promise<void> {
  if (!session) {
    await AsyncStorage.removeItem(TABLE_SESSION_STORAGE);
    return;
  }
  await AsyncStorage.setItem(TABLE_SESSION_STORAGE, JSON.stringify(session));
}

export type UsernamePromptFlags = {
  seenFirst: boolean;
  nudgeDismissed: boolean;
};

export async function loadUsernamePrompt(): Promise<UsernamePromptFlags> {
  const raw = await AsyncStorage.getItem(USERNAME_PROMPT_STORAGE);
  if (!raw) {
    return { seenFirst: false, nudgeDismissed: false };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UsernamePromptFlags>;
    return {
      seenFirst: parsed.seenFirst === true,
      nudgeDismissed: parsed.nudgeDismissed === true,
    };
  } catch {
    return { seenFirst: false, nudgeDismissed: false };
  }
}

export async function saveUsernamePrompt(flags: UsernamePromptFlags): Promise<void> {
  await AsyncStorage.setItem(USERNAME_PROMPT_STORAGE, JSON.stringify(flags));
}

export async function loadLegalVersion(): Promise<number> {
  const raw = await AsyncStorage.getItem(LEGAL_ACCEPT_STORAGE);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export async function saveLegalVersion(version: number): Promise<void> {
  await AsyncStorage.setItem(LEGAL_ACCEPT_STORAGE, String(version));
}
