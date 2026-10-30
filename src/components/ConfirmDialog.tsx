import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { UiButton } from './UiButton';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  overlayDismisses?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  overlayDismisses = true,
  onConfirm,
  onCancel,
}: Props) {
  if (!visible) {
    return null;
  }
  return (
    <Pressable style={styles.overlay} onPress={overlayDismisses ? onCancel : undefined}>
      <Pressable accessibilityRole="alert" style={styles.card} onPress={() => undefined}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.row}>
          {cancelLabel ? <UiButton label={cancelLabel} variant="secondary" onPress={onCancel} /> : null}
          <UiButton label={confirmLabel} onPress={onConfirm} />
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
    zIndex: 40,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
