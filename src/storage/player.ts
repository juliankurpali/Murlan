import AsyncStorage from '@react-native-async-storage/async-storage';
import { TABLE_SESSION_STORAGE } from './keys';

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
