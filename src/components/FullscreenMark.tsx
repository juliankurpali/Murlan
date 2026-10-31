import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = {
  label: string;
  active?: boolean;
  onPress: () => void;
};

function Corner({
  thickness,
  arm,
  top,
  left,
  flipX,
  flipY,
}: {
  thickness: number;
  arm: number;
  top: number;
  left: number;
  flipX?: boolean;
  flipY?: boolean;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        top,
        left,
        width: arm,
        height: arm,
        transform: [{ scaleX: flipX ? -1 : 1 }, { scaleY: flipY ? -1 : 1 }],
      }}
    >
      <View style={[styles.arm, { width: arm, height: thickness, backgroundColor: colors.gold }]} />
      <View style={[styles.arm, { width: thickness, height: arm, backgroundColor: colors.gold }]} />
    </View>
  );
}

function FullscreenGlyph({ active }: { active: boolean }) {
  const size = 16;
  const thickness = 2;
  const arm = 6;
  const inner = size - arm;
  const shift = active ? 3 : 0;
  return (
    <View style={{ width: size, height: size }}>
      <Corner thickness={thickness} arm={arm} top={shift} left={shift} />
      <Corner thickness={thickness} arm={arm} top={shift} left={inner - shift} flipX />
      <Corner thickness={thickness} arm={arm} top={inner - shift} left={shift} flipY />
      <Corner thickness={thickness} arm={arm} top={inner - shift} left={inner - shift} flipX flipY />
    </View>
  );
}

export function FullscreenMark({ label, active = false, onPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.hit,
          {
            top: Math.max(insets.top, 8),
            right: Math.max(insets.right, 8),
          },
          active && styles.hitOn,
          pressed && styles.pressed,
        ]}
      >
        <FullscreenGlyph active={active} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 32,
  },
  hit: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.55)',
    backgroundColor: 'rgba(8, 16, 18, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitOn: {
    backgroundColor: 'rgba(232, 197, 71, 0.2)',
    borderColor: colors.gold,
  },
  pressed: {
    opacity: 0.85,
  },
  arm: {
    position: 'absolute',
    borderRadius: 1,
  },
});
