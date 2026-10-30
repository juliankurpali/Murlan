import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PORT = 8787;

function metroHost(): string | null {
  const candidates = [Constants.expoConfig?.hostUri, Constants.linkingUri];
  for (const value of candidates) {
    if (!value) {
      continue;
    }
    const ip = value.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
    if (ip?.[1]) {
      return ip[1];
    }
    if (value.includes('localhost')) {
      return '127.0.0.1';
    }
  }
  return null;
}

export function apiRoots(): string[] {
  return relayUrls().map((url) => url.replace(/^ws/i, (match) => (match === 'wss' ? 'https' : 'http')));
}

export function relayUrls(): string[] {
  const fromEnv = process.env.EXPO_PUBLIC_RELAY_URL?.trim().replace(/\/+$/, '');
  if (fromEnv && !__DEV__) {
    return [fromEnv];
  }
  const urls = fromEnv ? [fromEnv] : [];
  const host = metroHost();
  if (host) {
    urls.push(`ws://${host}:${PORT}`);
  }
  if (Platform.OS === 'web') {
    urls.push(`ws://${window.location.hostname}:${PORT}`);
  }
  urls.push(`ws://127.0.0.1:${PORT}`);
  return [...new Set(urls)];
}
