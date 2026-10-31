import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';

export function BrandMark({ size = 22 }: { size?: number }) {
  const peak = Math.max(6, Math.round(size * 0.24));
  const band = Math.max(4, Math.round(size * 0.18));
  return (
    <View style={{ width: size, height: Math.round(size * 0.72) }}>
      <View
        style={[
          styles.band,
          {
            height: band,
            borderRadius: 2,
            left: size * 0.1,
            right: size * 0.1,
            bottom: 1,
          },
        ]}
      />
      <View
        style={[
          styles.peak,
          {
            width: peak,
            height: Math.round(size * 0.42),
            left: size * 0.12,
            bottom: band,
            transform: [{ rotate: '-18deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.peak,
          {
            width: peak,
            height: Math.round(size * 0.52),
            left: size * 0.38,
            bottom: band,
          },
        ]}
      />
      <View
        style={[
          styles.peak,
          {
            width: peak,
            height: Math.round(size * 0.42),
            right: size * 0.12,
            bottom: band,
            transform: [{ rotate: '18deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    backgroundColor: colors.gold,
  },
  peak: {
    position: 'absolute',
    backgroundColor: colors.gold,
  },
});
