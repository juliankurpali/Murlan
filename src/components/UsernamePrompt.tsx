import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { Language } from '../application/types';
import { t } from '../i18n';
import { isUsername, normalizeUsername } from '../platform/ids';
import { colors, radius, spacing } from '../theme';
import { UiButton } from './UiButton';

type Kind = 'first' | 'change';

type Props = {
  visible: boolean;
  kind: Kind;
  language: Language;
  currentName: string;
  error: string | null;
  saving?: boolean;
  onSave: (username: string) => void;
  onSkip: () => void;
};

type KeyboardFrame = {
  inset: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

function portalToBody(node: ReactElement): ReactNode {
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

function useKeyboardFrame(): KeyboardFrame {
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

export function UsernamePrompt({
  visible,
  kind,
  language,
  currentName,
  error,
  saving = false,
  onSave,
  onSkip,
}: Props) {
  const [value, setValue] = useState(kind === 'change' ? currentName : '');
  const frame = useKeyboardFrame();
  const compact = frame.inset > 40;

  useEffect(() => {
    if (!visible) {
      return;
    }
    setValue(kind === 'change' ? currentName : '');
  }, [visible, kind, currentName]);

  if (!visible) {
    return null;
  }

  const next = normalizeUsername(value);
  const canSave = isUsername(next) && !saving;
  const shown = value.length > 0 ? value : currentName;
  const overlayStyle: ViewStyle[] =
    Platform.OS === 'web' && frame.width > 0
      ? [
          styles.webRoot,
          compact ? styles.webRootCompact : null,
          {
            position: 'fixed' as unknown as 'absolute',
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
          },
        ].filter(Boolean) as ViewStyle[]
      : [
          styles.overlay,
          compact ? styles.overlayCompact : null,
          compact ? { paddingBottom: Math.max(6, frame.inset) } : null,
        ].filter(Boolean) as ViewStyle[];

  return portalToBody(
    <Pressable style={overlayStyle}>
      {compact ? (
        <View accessibilityRole="alert" style={styles.phoneBar}>
          <View style={styles.phoneFieldWrap}>
            {shown.length > 0 ? (
              <Text numberOfLines={1} style={styles.phoneMirror}>
                {shown}
              </Text>
            ) : null}
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              importantForAutofill="no"
              textContentType="none"
              autoFocus
              maxLength={16}
              editable={!saving}
              returnKeyType="done"
              placeholder={t(language, 'username')}
              placeholderTextColor={colors.muted}
              value={value}
              onChangeText={(text) => setValue(normalizeUsername(text))}
              onSubmitEditing={() => {
                if (canSave) {
                  onSave(next);
                }
              }}
              style={styles.phoneField}
            />
          </View>
          <UiButton
            label={t(language, 'notNow')}
            variant="secondary"
            disabled={saving}
            onPress={onSkip}
            style={styles.phoneBtn}
          />
          <UiButton
            label={t(language, 'saveUsername')}
            disabled={!canSave}
            onPress={() => onSave(next)}
            style={styles.phoneBtn}
          />
        </View>
      ) : (
        <Pressable accessibilityRole="alert" style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>
            {t(language, kind === 'first' ? 'pickUsernameTitle' : 'changeUsernameTitle')}
          </Text>
          <Text style={styles.body}>
            {kind === 'first'
              ? t(language, 'pickUsernameBody')
              : t(language, 'changeUsernameBody', { name: currentName })}
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            importantForAutofill="no"
            textContentType="none"
            autoFocus
            maxLength={16}
            editable={!saving}
            returnKeyType="done"
            placeholder={t(language, 'username')}
            placeholderTextColor={colors.muted}
            value={value}
            onChangeText={(text) => setValue(normalizeUsername(text))}
            onSubmitEditing={() => {
              if (canSave) {
                onSave(next);
              }
            }}
            style={styles.field}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <UiButton label={t(language, 'notNow')} variant="secondary" disabled={saving} onPress={onSkip} />
            <UiButton label={t(language, 'saveUsername')} disabled={!canSave} onPress={() => onSave(next)} />
          </View>
        </Pressable>
      )}
    </Pressable>,
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    zIndex: 50,
  },
  overlayCompact: {
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingTop: 4,
  },
  webRoot: {
    zIndex: 200,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  webRootCompact: {
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 6,
  },
  card: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '72%',
    maxWidth: 520,
    gap: spacing.md,
  },
  phoneBar: {
    width: '100%',
    maxWidth: 720,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cream,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  phoneFieldWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
  },
  phoneMirror: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  phoneField: {
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.feltLight,
    color: colors.ink,
    paddingHorizontal: 10,
    backgroundColor: colors.card,
    fontSize: 16,
    fontWeight: '700',
  },
  phoneBtn: {
    minHeight: 36,
    minWidth: 64,
    paddingHorizontal: 10,
    flexShrink: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  body: {
    fontSize: 16,
    color: colors.ink,
    lineHeight: 22,
  },
  field: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLight,
    color: colors.ink,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginTop: -8,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
