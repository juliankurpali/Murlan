import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotionPressable, tapTransition } from '../motion';
import { colors } from '../theme';

type Props = {
  kind: 'play' | 'pass' | 'menu';
  disabled?: boolean;
  onPress: () => void;
  label: string;
};

function Glyph({ kind }: { kind: Props['kind'] }) {
  if (kind === 'play') {
    return (
      <View style={styles.playStack}>
        <View style={[styles.mini, styles.miniBack]} />
        <View style={styles.mini} />
      </View>
    );
  }
  if (kind === 'pass') {
    return <View style={styles.skip} />;
  }
  return (
    <View style={styles.bars}>
      <View style={styles.bar} />
      <View style={styles.bar} />
      <View style={styles.bar} />
    </View>
  );
}

export function ActionOrb({ kind, disabled, onPress, label }: Props) {
  const look = [
    styles.orb,
    kind === 'play' && styles.play,
    kind === 'pass' && styles.pass,
    kind === 'menu' && styles.menu,
    disabled && styles.disabled,
  ];

  if (Platform.OS === 'web') {
    return (
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        whileHover={disabled ? undefined : { scale: 1.06 }}
        whileTap={disabled ? undefined : { scale: 0.92 }}
        transition={tapTransition}
        style={look}
      >
        {kind === 'play' ? (
          <LinearGradient
            colors={['#F4D78A', '#C9A227', '#8A6B1F']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.fill}
          />
        ) : null}
        {kind === 'pass' ? (
          <LinearGradient
            colors={['#145C45', '#07281E']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.fill}
          />
        ) : null}
        <Glyph kind={kind} />
      </MotionPressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [...look, pressed && !disabled && styles.pressed]}
    >
      {kind === 'play' ? (
        <LinearGradient
          colors={['#F4D78A', '#C9A227', '#8A6B1F']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.fill}
        />
      ) : null}
      {kind === 'pass' ? (
        <LinearGradient
          colors={['#145C45', '#07281E']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fill}
        />
      ) : null}
      <Glyph kind={kind} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  orb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    minHeight: 44,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  play: {
    backgroundColor: colors.gold,
    borderColor: '#F8E7B0',
  },
  pass: {
    backgroundColor: colors.feltDark,
    borderColor: colors.gold,
  },
  menu: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  playStack: {
    width: 22,
    height: 22,
  },
  mini: {
    position: 'absolute',
    width: 14,
    height: 20,
    borderRadius: 3,
    backgroundColor: colors.ink,
    right: 0,
  },
  miniBack: {
    left: 0,
    opacity: 0.45,
    transform: [{ rotate: '-12deg' }],
  },
  skip: {
    width: 18,
    height: 4,
    backgroundColor: colors.gold,
    borderRadius: 2,
    transform: [{ rotate: '-28deg' }],
  },
  bars: {
    gap: 4,
  },
  bar: {
    width: 18,
    height: 2,
    backgroundColor: '#c7d2d0',
    borderRadius: 1,
  },
});
