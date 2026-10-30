import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { SeatId } from '../domain';
import { MotionView } from '../motion';
import { colors, motion } from '../theme';
import { TableSize, visualSeatPoint } from './tableLayout';

type Props = {
  burstKey: string;
  seat: SeatId;
  localSeat?: SeatId;
  label: string;
  tableSize: TableSize | null;
};

export function PassBurst({ burstKey, seat, localSeat = 0, tableSize }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    opacity.setValue(0);
    rise.setValue(18);
    scale.setValue(0.7);
    const run = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: motion.nativeDriver,
      }),
      Animated.timing(rise, {
        toValue: -10,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: motion.nativeDriver,
      }),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.1,
          friction: 5,
          tension: 160,
          useNativeDriver: motion.nativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 420,
          delay: 280,
          useNativeDriver: motion.nativeDriver,
        }),
      ]),
    ]);
    run.start();
    return () => run.stop();
  }, [burstKey, seat, opacity, rise, scale]);

  if (!tableSize) {
    return null;
  }
  const point = visualSeatPoint(seat, localSeat, tableSize);

  if (Platform.OS === 'web') {
    return (
      <MotionView
        key={burstKey}
        pointerEvents="none"
        initial={{ opacity: 0, scale: 0.65, y: 14 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.65, 1.12, 1, 0.9], y: -12 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={[styles.seal, { left: point.x - 16, top: point.y - 16 }]}
      >
        <View style={styles.slash} />
      </MotionView>
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.seal,
        {
          left: point.x - 16,
          top: point.y - 16,
          opacity,
          transform: [{ translateY: rise }, { scale }],
        },
      ]}
    >
      <View style={styles.slash} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  seal: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    borderWidth: 2,
    borderColor: '#F4B4AA',
  },
  slash: {
    width: 18,
    height: 4,
    backgroundColor: colors.cream,
    borderRadius: 2,
    transform: [{ rotate: '-28deg' }],
  },
});
