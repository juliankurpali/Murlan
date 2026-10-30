import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  progress: number;
  size?: number;
};

const TICKS = 20;

export function TurnClock({ progress, size = 54 }: Props) {
  const remaining = Math.max(0, Math.ceil((1 - progress) * TICKS));
  const radius = size / 2 - 5;
  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size }]}>
      {Array.from({ length: TICKS }, (_, index) => {
        const angle = (index / TICKS) * Math.PI * 2 - Math.PI / 2;
        const x = size / 2 + Math.cos(angle) * radius - 2;
        const y = size / 2 + Math.sin(angle) * radius - 5;
        const on = index < remaining;
        const urgent = remaining <= 5 && on;
        return (
          <View
            key={index}
            style={[
              styles.tick,
              {
                left: x,
                top: y,
                transform: [{ rotate: `${(index / TICKS) * 360}deg` }],
                backgroundColor: urgent ? colors.danger : on ? colors.gold : 'rgba(255,255,255,0.16)',
                opacity: on ? 1 : 0.35,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    overflow: 'hidden',
  },
  tick: {
    position: 'absolute',
    width: 3,
    height: 6,
    borderRadius: 1,
  },
});
