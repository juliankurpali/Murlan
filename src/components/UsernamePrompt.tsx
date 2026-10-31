import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const read = () => {
        const viewport = window.visualViewport;
        if (!viewport) {
          setInset(0);
          return;
        }
        setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
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
    const show = Keyboard.addListener('keyboardDidShow', (event) => setInset(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return inset;
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
  const keyboardInset = useKeyboardInset();
  const compact = keyboardInset > 48;

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

  return (
    <Pressable
      style={[
        styles.overlay,
        compact && styles.overlayCompact,
        compact && { paddingBottom: Math.max(6, keyboardInset) },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        style={[styles.card, compact && styles.cardCompact]}
        onPress={() => undefined}
      >
        {compact ? (
          <Text style={styles.compactLabel}>{t(language, 'username')}</Text>
        ) : (
          <>
            <Text style={styles.title}>
              {t(language, kind === 'first' ? 'pickUsernameTitle' : 'changeUsernameTitle')}
            </Text>
            <Text style={styles.body}>
              {kind === 'first'
                ? t(language, 'pickUsernameBody')
                : t(language, 'changeUsernameBody', { name: currentName })}
            </Text>
          </>
        )}
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
          placeholder={t(language, 'username')}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={(text) => setValue(normalizeUsername(text))}
          style={[styles.field, compact && styles.fieldCompact]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={[styles.row, compact && styles.rowCompact]}>
          <UiButton
            label={t(language, 'notNow')}
            variant="secondary"
            disabled={saving}
            onPress={onSkip}
            style={compact ? styles.compactBtn : undefined}
          />
          <UiButton
            label={t(language, 'saveUsername')}
            disabled={!canSave}
            onPress={() => onSave(next)}
            style={compact ? styles.compactBtn : undefined}
          />
        </View>
      </Pressable>
    </Pressable>
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
  card: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '72%',
    maxWidth: 520,
    gap: spacing.md,
  },
  cardCompact: {
    width: '100%',
    maxWidth: 720,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
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
  compactLabel: {
    width: '100%',
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
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
  fieldCompact: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 160,
    minHeight: 44,
    fontSize: 18,
    fontWeight: '700',
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
  rowCompact: {
    flexShrink: 0,
  },
  compactBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
  },
});
