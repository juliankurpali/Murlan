import { Platform } from 'react-native';

export type FullscreenKind = 'api' | 'home-screen' | 'standalone' | 'none';

type FullscreenNode = {
  requestFullscreen?: () => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitIsFullScreen?: boolean;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

function webDoc(): FullscreenDoc | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return null;
  }
  return document as FullscreenDoc;
}

function applePhone(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  return /iPhone|iPod/i.test(navigator.userAgent) && !('MSStream' in window);
}

function requestFullscreenFn(node: FullscreenNode): (() => Promise<void> | void) | undefined {
  return (
    node.requestFullscreen ??
    node.webkitRequestFullscreen ??
    node.webkitRequestFullScreen ??
    node.msRequestFullscreen
  );
}

function exitFullscreenFn(doc: FullscreenDoc): (() => Promise<void> | void) | undefined {
  return doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.webkitCancelFullScreen ?? doc.msExitFullscreen;
}

export function isStandaloneDisplay(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) {
    return true;
  }
  return (
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  );
}

export function isFullscreen(): boolean {
  const doc = webDoc();
  if (!doc) {
    return false;
  }
  if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement || doc.webkitIsFullScreen) {
    return true;
  }
  return isStandaloneDisplay();
}

export function fullscreenKind(): FullscreenKind {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return 'none';
  }
  if (isStandaloneDisplay()) {
    return 'standalone';
  }
  const request = requestFullscreenFn(document.documentElement as FullscreenNode);
  if (typeof request === 'function') {
    return 'api';
  }
  if (applePhone()) {
    return 'home-screen';
  }
  return 'none';
}

export function fullscreenAvailable(): boolean {
  const kind = fullscreenKind();
  return kind === 'api' || kind === 'home-screen';
}

export async function toggleFullscreen(): Promise<'entered' | 'exited' | 'home-screen' | 'standalone' | 'unavailable'> {
  const kind = fullscreenKind();
  if (kind === 'home-screen') {
    return 'home-screen';
  }
  if (kind === 'standalone') {
    return 'standalone';
  }
  const doc = webDoc();
  if (!doc || kind !== 'api') {
    return 'unavailable';
  }
  try {
    const apiOpen = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement || doc.webkitIsFullScreen);
    if (apiOpen) {
      const exit = exitFullscreenFn(doc);
      if (!exit) {
        return 'unavailable';
      }
      await Promise.resolve(exit.call(doc));
      return 'exited';
    }
    const request = requestFullscreenFn(doc.documentElement as FullscreenNode);
    if (!request) {
      return 'unavailable';
    }
    await Promise.resolve(request.call(doc.documentElement));
    return 'entered';
  } catch {
    return applePhone() ? 'home-screen' : 'unavailable';
  }
}

export function subscribeFullscreen(onChange: () => void): () => void {
  const doc = webDoc();
  if (!doc) {
    return () => undefined;
  }
  const events = ['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'] as const;
  for (const event of events) {
    doc.addEventListener(event, onChange);
  }
  return () => {
    for (const event of events) {
      doc.removeEventListener(event, onChange);
    }
  };
}
