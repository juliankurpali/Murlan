import { Platform, Share } from 'react-native';
import * as Linking from 'expo-linking';
import { isRoomCode } from './room';

function webAppRoot(): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname.replace(/[^/]*$/, '')}`;
}

export function roomInviteUrl(code: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${webAppRoot()}?code=${encodeURIComponent(code.toUpperCase())}`;
  }
  return Linking.createURL('join', { queryParams: { code: code.toUpperCase() } });
}

export function adminFlagFromLink(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(
      url
        .replace(/^exp:\/\//i, 'https://')
        .replace(/^exps:\/\//i, 'https://')
        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, (scheme) =>
          scheme.toLowerCase() === 'https://' || scheme.toLowerCase() === 'http://' ? scheme : 'https://link.host/',
        ),
    );
    return parsed.searchParams.get('admin') === '1';
  } catch {
    return false;
  }
}

export function joinCodeFromLink(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  const normalized = url
    .replace(/^exp:\/\//i, 'https://')
    .replace(/^exps:\/\//i, 'https://')
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, (scheme) => (scheme.toLowerCase() === 'https://' || scheme.toLowerCase() === 'http://' ? scheme : 'https://link.host/'));
  try {
    const parsed = new URL(normalized);
    const fromQuery = parsed.searchParams.get('code') ?? parsed.searchParams.get('room');
    if (fromQuery && isRoomCode(fromQuery.toUpperCase())) {
      return fromQuery.toUpperCase();
    }
    const path = decodeURIComponent(parsed.pathname);
    const match = path.match(/(?:^|\/)join\/([A-Za-z0-9]{4})(?:\/|$)/i);
    if (match?.[1] && isRoomCode(match[1].toUpperCase())) {
      return match[1].toUpperCase();
    }
  } catch {
    return null;
  }
  return null;
}

export function clearJoinFromAddressBar() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  if (url.searchParams.has('code') || url.searchParams.has('room')) {
    url.searchParams.delete('code');
    url.searchParams.delete('room');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

export function clearAdminFromAddressBar() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  if (url.searchParams.has('admin')) {
    url.searchParams.delete('admin');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

export async function shareRoomLink(code: string, message: string): Promise<'shared' | 'copied'> {
  const url = roomInviteUrl(code);
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ text: message, url });
        return 'shared';
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return 'shared';
        }
      }
    }
    await nav?.clipboard?.writeText(`${message} ${url}`);
    return 'copied';
  }
  await Share.share({
    message: `${message} ${url}`,
    url,
  });
  return 'shared';
}
