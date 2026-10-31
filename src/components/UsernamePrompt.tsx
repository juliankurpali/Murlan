import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Language } from '../application/types';
import { t } from '../i18n';
import { isUsername, normalizeUsername } from '../platform/ids';
import { colors, radius, spacing } from '../theme';
import { KeyboardField } from './KeyboardField';
import { portalToBody, useKeyboardFrame } from './keyboardOverlay';
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
  const actions = () => (
    <>
      <UiButton
        label={t(language, 'notNow')}
        variant="secondary"
        disabled={saving}
        onPress={onSkip}
        style={styles.barBtn}
      />
      <UiButton
        label={t(language, 'saveUsername')}
        disabled={!canSave}
        onPress={() => onSave(next)}
        style={styles.barBtn}
      />
    </>
  );
  const field = (
    <KeyboardField
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
      label={t(language, 'username')}
      accessory={actions()}
      onChangeText={(text) => setValue(normalizeUsername(text))}
      onSubmitEditing={() => {
        if (canSave) {
          onSave(next);
        }
      }}
      style={styles.field}
    />
  );
  const overlayStyle: ViewStyle[] =
    Platform.OS === 'web' && frame.width > 0
      ? [
          styles.webRoot,
          {
            position: 'fixed' as unknown as 'absolute',
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
          },
        ]
      : [styles.overlay];

  return portalToBody(
    <Pressable style={overlayStyle}>
      <Pressable accessibilityRole="alert" style={styles.card} onPress={() => undefined}>
        <Text style={styles.title}>
          {t(language, kind === 'first' ? 'pickUsernameTitle' : 'changeUsernameTitle')}
        </Text>
        <Text style={styles.body}>
          {kind === 'first'
            ? t(language, 'pickUsernameBody')
            : t(language, 'changeUsernameBody', { name: currentName })}
        </Text>
        {field}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.row}>{actions()}</View>
      </Pressable>
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
  webRoot: {
    zIndex: 200,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  card: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '72%',
    maxWidth: 520,
    gap: spacing.md,
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
  barBtn: {
    minHeight: 36,
    minWidth: 64,
    paddingHorizontal: 10,
    flexShrink: 0,
  },
});
