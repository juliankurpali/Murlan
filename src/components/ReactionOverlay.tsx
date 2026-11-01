import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SeatId } from '../domain';
import { reactionOf, type ReactionEvent } from '../reactions';
import { motion } from '../theme';
import { reactionMarkPoint, type Point, type TableSize } from './tableLayout';

type Props = {
  events: ReactionEvent[];
  localSeat: SeatId;
  seatOfPlayer: (playerId: string) => SeatId | null;
  tableSize: TableSize | null;
  seatCount: number;
};

const SHIFT = [-18, 0, 18];
const MARK = 44;

function seatFrom(
  playerId: string,
  fallback: number | undefined,
  seatOfPlayer: (playerId: string) => SeatId | null,
): SeatId | null {
  const mapped = seatOfPlayer(playerId);
  if (mapped !== null) {
    return mapped;
  }
  if (Number.isInteger(fallback) && (fallback ?? -1) >= 0) {
    return fallback as SeatId;
  }
  return null;
}

export function ReactionOverlay({ events, localSeat, seatOfPlayer, tableSize, seatCount }: Props) {
  if (!tableSize) {
    return null;
  }
  return (
    <View pointerEvents="none" style={styles.layer}>
      {events.map((event, index) => {
        const targetSeat = seatFrom(event.targetPlayerId, event.targetSeat, seatOfPlayer);
        if (targetSeat === null) {
          return null;
        }
        const senderSeat = seatFrom(event.senderPlayerId, event.senderSeat, seatOfPlayer) ?? localSeat;
        const shift = SHIFT[index % SHIFT.length] ?? 0;
        const to = reactionMarkPoint(targetSeat, localSeat, tableSize, seatCount, shift);
        const from =
          senderSeat === targetSeat
            ? to
            : reactionMarkPoint(senderSeat, localSeat, tableSize, seatCount);
        const left = Math.max(2, Math.min(tableSize.width - MARK - 2, to.x - MARK / 2));
        const top = Math.max(2, Math.min(tableSize.height - MARK - 2, to.y));
        return (
          <View
            key={event.eventId}
            accessibilityLabel={reactionOf(event.reactionId).id}
            style={[styles.anchor, { left, top }]}
          >
            <ReactionBurst
              event={event}
              travel={{ x: from.x - (left + MARK / 2), y: from.y - top }}
            />
          </View>
        );
      })}
    </View>
  );
}

function ReactionBurst({ event, travel }: { event: ReactionEvent; travel: Point }) {
  const spec = reactionOf(event.reactionId);
  const opacity = useRef(new Animated.Value(1)).current;
  const flight = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.55)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const fly = Math.hypot(travel.x, travel.y) > 16;

  useEffect(() => {
    opacity.setValue(1);
    flight.setValue(fly ? 0 : 1);
    lift.setValue(event.reactionId === 'crown' ? -18 : 0);
    scale.setValue(0.55);
    wobble.setValue(0);
    const trip = fly
      ? Animated.timing(flight, {
          toValue: 1,
          duration: 560,
          easing: Easing.bezier(0.16, 0.84, 0.22, 1),
          useNativeDriver: motion.nativeDriver,
        })
      : null;
    const land = Animated.parallel([
      Animated.spring(scale, {
        toValue:
          event.reactionId === 'clown' || event.reactionId === 'heart' || event.reactionId === 'kiss'
            ? 1.16
            : event.reactionId === 'sparkle'
              ? 1.12
              : 1,
        friction: 5,
        tension: 160,
        useNativeDriver: motion.nativeDriver,
      }),
      Animated.spring(lift, {
        toValue: event.reactionId === 'piggy' || event.reactionId === 'heart' ? -6 : event.reactionId === 'sparkle' ? -10 : 0,
        friction: 4,
        tension: 140,
        useNativeDriver: motion.nativeDriver,
      }),
    ]);
    const shake =
      event.reactionId === 'lol'
        ? Animated.sequence([
            Animated.timing(wobble, { toValue: 1, duration: 80, useNativeDriver: motion.nativeDriver }),
            Animated.timing(wobble, { toValue: -1, duration: 120, useNativeDriver: motion.nativeDriver }),
            Animated.timing(wobble, { toValue: 0, duration: 80, useNativeDriver: motion.nativeDriver }),
          ])
        : null;
    Animated.sequence([
      ...(trip ? [trip] : []),
      land,
      ...(shake ? [shake] : []),
      Animated.delay(fly ? 900 : 1400),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.quad),
        useNativeDriver: motion.nativeDriver,
      }),
    ]).start();
  }, [event.eventId, event.reactionId, fly, flight, lift, opacity, scale, wobble]);

  return (
    <Animated.View
      style={[
        styles.mark,
        {
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
                outputRange: [travel.y, travel.y * 0.45 - 36, 0],
              }),
            },
            { translateY: lift },
            { scale },
            {
              rotate: wobble.interpolate({
                inputRange: [-1, 1],
                outputRange: ['-12deg', '12deg'],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.glyph}>{spec.glyph}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 24,
    elevation: 24,
  },
  anchor: {
    position: 'absolute',
    width: MARK,
    height: MARK,
    zIndex: 25,
  },
  mark: {
    width: MARK,
    height: MARK,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(8, 16, 18, 0.35)',
  },
  glyph: {
    fontSize: 34,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
