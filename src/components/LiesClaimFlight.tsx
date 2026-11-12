import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SeatId } from '../domain';
import { motion } from '../theme';
import { CardBack } from './CardBack';
import {
  FLIGHT_CARD,
  FLIGHT_CARD_PHONE,
  isPhoneViewport,
  playOriginPoint,
  tableCenter,
  TableSize,
  visualOffset,
} from './tableLayout';

type Props = {
  playKey: string;
  count: number;
  /** How many backs are already sitting on the pile (flight lands after these). */
  landFromIndex?: number;
  fromSeat: SeatId;
  localSeat: SeatId;
  tableSize: TableSize | null;
  seatCount: number;
  onLanded: (playKey: string) => void;
};

function startRotate(visual: number, seatCount: number): string {
  if (visual === 0) return '-6deg';
  if (seatCount >= 5) {
    if (visual === 1 || visual === 2) return '-22deg';
    if (visual >= 4) return '22deg';
    return '8deg';
  }
  if (visual === 1) return '-26deg';
  if (visual === 3) return '26deg';
  return '10deg';
}

function FlyingBack({
  index,
  count,
  landFromIndex,
  fromSeat,
  localSeat,
  tableSize,
  seatCount,
  playKey,
  isLast,
  onLanded,
}: {
  index: number;
  count: number;
  landFromIndex: number;
  fromSeat: SeatId;
  localSeat: SeatId;
  tableSize: TableSize;
  seatCount: number;
  playKey: string;
  isLast: boolean;
  onLanded: (playKey: string) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const landedRef = useRef(onLanded);
  landedRef.current = onLanded;

  const phone = isPhoneViewport(tableSize.width, tableSize.height);
  const base = phone ? FLIGHT_CARD_PHONE : FLIGHT_CARD;
  const dim = {
    width: Math.round(base.width * (phone ? 0.62 : 0.68)),
    height: Math.round(base.height * (phone ? 0.62 : 0.68)),
  };

  const origin = playOriginPoint(fromSeat, localSeat, tableSize, seatCount);
  const center = tableCenter(tableSize);
  const visual = visualOffset(fromSeat, localSeat, seatCount);
  const startX = origin.x - center.x;
  const startY = origin.y - center.y;
  const midY = startY * 0.42 - 24;

  // Match LiesPileCenter cascade so cards settle into the real pile.
  const totalAfter = landFromIndex + count;
  const maxSpanX = phone ? 34 : 42;
  const maxSpanY = phone ? 26 : 32;
  const stepX = totalAfter <= 1 ? 0 : Math.min(phone ? 2.8 : 3.2, maxSpanX / Math.max(1, totalAfter - 1));
  const stepY = totalAfter <= 1 ? 0 : Math.min(phone ? 2.0 : 2.4, maxSpanY / Math.max(1, totalAfter - 1));
  const landIndex = landFromIndex + index;
  const landX = Math.round(landIndex * stepX) - Math.round(((totalAfter - 1) * stepX) / 2);
  const landY = Math.round(landIndex * stepY) - Math.round(((totalAfter - 1) * stepY) / 2);

  useEffect(() => {
    progress.setValue(0);
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: Math.round(motion.flightMs * 0.92),
      delay: index * Math.min(48, motion.staggerMs),
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: motion.nativeDriver,
    });
    run.start(({ finished }) => {
      if (finished && isLast) {
        landedRef.current(playKey);
      }
    });
    return () => run.stop();
  }, [playKey, fromSeat, index, isLast, progress, seatCount, localSeat]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.card,
        {
          left: center.x - dim.width / 2,
          top: center.y - dim.height / 2,
          zIndex: 30 + index,
          opacity: progress.interpolate({
            inputRange: [0, 0.08, 1],
            outputRange: [0, 1, 1],
          }),
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [startX, landX],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [startY, midY, landY],
              }),
            },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [startRotate(visual, seatCount), `${(index - (count - 1) / 2) * 2}deg`],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.55, 1],
                outputRange: [0.82, 1.04, 1],
              }),
            },
          ],
        },
      ]}
    >
      <CardBack width={dim.width} height={dim.height} />
    </Animated.View>
  );
}

/** Face-down cards flying from a seat onto the Lies pile. */
export function LiesClaimFlight({
  playKey,
  count,
  landFromIndex = 0,
  fromSeat,
  localSeat,
  tableSize,
  seatCount,
  onLanded,
}: Props) {
  if (!tableSize || tableSize.width < 8 || count < 1) {
    return null;
  }
  const n = Math.min(count, 8);
  return (
    <View pointerEvents="none" style={styles.layer}>
      {Array.from({ length: n }, (_, index) => (
        <FlyingBack
          key={`${playKey}-${index}`}
          index={index}
          count={n}
          landFromIndex={landFromIndex}
          fromSeat={fromSeat}
          localSeat={localSeat}
          tableSize={tableSize}
          seatCount={seatCount}
          playKey={playKey}
          isLast={index === n - 1}
          onLanded={onLanded}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 26,
    elevation: 26,
  },
  card: {
    position: 'absolute',
  },
});
