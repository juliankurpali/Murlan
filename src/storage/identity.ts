import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AUTH_STORAGE, AUTH_STORAGE_LEGACY, IDENTITY_STORAGE, PLAYER_KEY_STORAGE } from './keys';

export type AuthSession = {
  token: string;
  playerId: string;
};

const SECURE: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, SECURE);
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value, SECURE);
    return;
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadIdentitySecret(): Promise<string> {
  const stored = await secureGet(IDENTITY_STORAGE);
  if (stored && stored.length >= 16) {
    return stored;
  }
  const legacy = await AsyncStorage.getItem(PLAYER_KEY_STORAGE);
  if (legacy && legacy.length >= 8) {
    await secureSet(IDENTITY_STORAGE, legacy);
    await AsyncStorage.removeItem(PLAYER_KEY_STORAGE);
    return legacy;
  }
  const secret = bytesToHex(await Crypto.getRandomBytesAsync(32));
  await secureSet(IDENTITY_STORAGE, secret);
  return secret;
}

export async function loadSecureAuth(): Promise<AuthSession | null> {
  const raw = (await secureGet(AUTH_STORAGE)) ?? (await AsyncStorage.getItem(AUTH_STORAGE_LEGACY));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed.token === 'string' && typeof parsed.playerId === 'string') {
      return { token: parsed.token, playerId: parsed.playerId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveSecureAuth(session: AuthSession | null): Promise<void> {
  if (!session) {
    try {
      await SecureStore.deleteItemAsync(AUTH_STORAGE);
    } catch {
      await AsyncStorage.removeItem(AUTH_STORAGE);
    }
    return;
  }
  await secureSet(AUTH_STORAGE, JSON.stringify(session));
  await AsyncStorage.removeItem(AUTH_STORAGE_LEGACY);
}
