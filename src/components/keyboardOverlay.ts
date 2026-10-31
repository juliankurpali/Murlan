import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Keyboard, Platform } from 'react-native';

export type KeyboardFrame = {
  inset: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export function portalToBody(node: ReactElement): ReactNode {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return node;
  }
  // Native Metro must not statically import react-dom.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-dom') as {
    createPortal: (children: ReactElement, container: { nodeType: number }) => ReactNode;
  };
  return mod.createPortal(node, document.body);
}

export function useKeyboardFrame(): KeyboardFrame {
  const [frame, setFrame] = useState<KeyboardFrame>({
    inset: 0,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const read = () => {
        const viewport = window.visualViewport;
        if (!viewport) {
          setFrame({
            inset: 0,
            left: 0,
            top: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          });
          return;
        }
        setFrame({
          inset: Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)),
          left: Math.round(viewport.offsetLeft),
          top: Math.round(viewport.offsetTop),
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
        });
      };
      const viewport = window.visualViewport;
      window.addEventListener('resize', read);
      viewport?.addEventListener('resize', read);
      viewport?.addEventListener('scroll', read);
      read();
      return () => {
        window.removeEventListener('resize', read);
        viewport?.removeEventListener('resize', read);
        viewport?.removeEventListener('scroll', read);
      };
    }
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setFrame((prev) => ({ ...prev, inset: Math.round(event.endCoordinates.height) }));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setFrame((prev) => ({ ...prev, inset: 0 }));
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return frame;
}
