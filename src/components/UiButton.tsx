import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'go';
  accessibilityHint?: string;
  style?: ViewStyle;
};

export function UiButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  accessibilityHint,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'go' && styles.go,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        pressed && !disabled && styles.pressedScale,
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          variant === 'secondary' && styles.secondaryLabel,
          variant === 'ghost' && styles.ghostLabel,
          variant === 'go' && styles.goLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 40,
    minWidth: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.goldHi,
    shadowColor: colors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  go: {
    backgroundColor: colors.good,
    borderWidth: 1.5,
    borderColor: '#6ee7a0',
    shadowColor: colors.good,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  secondary: {
    backgroundColor: 'rgba(14, 32, 36, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(160, 190, 210, 0.38)',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.38,
  },
  pressed: {
    opacity: 0.88,
  },
  pressedScale: {
    transform: [{ scale: 0.97 }],
  },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  secondaryLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  ghostLabel: {
    color: colors.gold,
    letterSpacing: 1.8,
  },
  goLabel: {
    color: '#fff',
    letterSpacing: 1.6,
  },
});
