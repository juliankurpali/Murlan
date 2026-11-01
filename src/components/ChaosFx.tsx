import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { ChaosNotice, SeatId } from '../domain';
import { motion } from '../theme';
import { ABILITY_GLYPH } from './AbilityMark';
import { reactionMarkPoint, type Point, type TableSize } from './tableLayout';

type Props = {
  notice: ChaosNotice | null;
  localSeat: SeatId;
  tableSize: TableSize | null;
  seatCount: number;
};

const MARK = 52;
const FX_MS = 1800;

const TINT: Record<string, string> = {
  mindReader: 'rgba(168, 132, 255, 0.42)',
  freeze: 'rgba(126, 200, 255, 0.5)',
  cardThief: 'rgba(246, 231, 162, 0.45)',
  shield: 'rgba(143, 212, 168, 0.48)',
  secondChance: 'rgba(246, 231, 162, 0.45)',
  wildCard: 'rgba(255, 179, 71, 0.48)',
  lastManStanding: 'rgba(255, 138, 122, 0.48)',
  jokerKing: 'rgba(232, 197, 71, 0.45)',
};

export function ChaosFx({ notice, localSeat, tableSize, seatCount }: Props) {
  if (!tableSize || !notice || Date.now() - notice.at > FX_MS + 400) {
    return null;
  }
  const source = notice.sourceSeat;
  const target = notice.targetSeat;
  const toSeat = target ?? source;
  if (toSeat === undefined) {
    return null;
  }
  const to = reactionMarkPoint(toSeat, localSeat, tableSize, seatCount);
  const from =
    source !== undefined && target !== undefined && source !== target
      ? reactionMarkPoint(source, localSeat, tableSize, seatCount)
      : to;
  const left = Math.max(2, Math.min(tableSize.width - MARK - 2, to.x - MARK / 2));
  const top = Math.max(2, Math.min(tableSize.height - MARK - 2, to.y));
  return (
    <View pointerEvents="none" style={styles.layer}>
      <View key={notice.id} style={[styles.anchor, { left, top }]}>
        <ChaosBurst
          glyph={ABILITY_GLYPH[notice.abilityId]}
          tint={TINT[notice.abilityId] ?? 'rgba(232, 197, 71, 0.4)'}
          travel={{ x: from.x - (left + MARK / 2), y: from.y - top }}
        />
      </View>
    </View>
  );
}

function ChaosBurst({ glyph, tint, travel }: { glyph: string; tint: string; travel: Point }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const flight = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const fly = Math.hypot(travel.x, travel.y) > 16;

  useEffect(() => {
    opacity.setValue(1);
    flight.setValue(fly ? 0 : 1);
    scale.setValue(0.4);
    const trip = fly
      ? Animated.timing(flight, {
          toValue: 1,
          duration: 520,
          easing: Easing.bezier(0.16, 0.84, 0.22, 1),
          useNativeDriver: motion.nativeDriver,
        })
      : null;
    Animated.sequence([
      ...(trip ? [trip] : []),
      Animated.spring(scale, {
        toValue: 1.18,
        friction: 4,
        tension: 150,
        useNativeDriver: motion.nativeDriver,
      }),
      Animated.delay(720),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: motion.nativeDriver,
      }),
    ]).start();
  }, [fly, flight, opacity, scale]);

  return (
    <Animated.View
      style={[
        styles.mark,
        {
          backgroundColor: tint,
          opacity,
          transform: [
            {
              translateX: flight.interpolate({
                inputRange: [0, 1],
                outputRange: [travel.x, 0],
              }),
            },
            {
              translateY: flight.interpolate({
                inputRange: [0, 0.42, 1],
                outputRange: [travel.y, travel.y * 0.45 - 32, 0],
              }),
            },
            { scale },
          ],
        },
      ]}
    >
      <Text style={styles.glyph}>{glyph}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 22,
    elevation: 22,
  },
  anchor: {
    position: 'absolute',
    width: MARK,
    height: MARK,
    zIndex: 23,
  },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  glyph: {
    fontSize: 28,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
