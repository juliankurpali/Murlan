import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Card, SeatId } from '../domain';
import { Language } from '../application/types';
import { motion } from '../theme';
import { CardFace } from './CardFace';
import {
  fanSpread,
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
  cards: Card[];
  fromSeat: SeatId;
  localSeat?: SeatId;
  tableSize: TableSize | null;
  language: Language;
  seatCount?: number;
  onLanded: (playKey: string) => void;
};

function startRotate(visual: SeatId, seatCount: number): string {
  if (visual === 0) {
    return '-8deg';
  }
  if (seatCount === 6) {
    if (visual === 1 || visual === 2) {
      return '-28deg';
    }
    if (visual === 4 || visual === 5) {
      return '28deg';
    }
    return '10deg';
  }
  if (visual === 1) {
    return '-32deg';
  }
  if (visual === 3) {
    return '32deg';
  }
  return '16deg';
}

function FlyingCard({
  card,
  index,
  count,
  fromSeat,
  localSeat,
  tableSize,
  language,
  seatCount,
  playKey,
  isLast,
  onLanded,
}: {
  card: Card;
  index: number;
  count: number;
  fromSeat: SeatId;
  localSeat: SeatId;
  tableSize: TableSize;
  language: Language;
  seatCount: number;
  playKey: string;
  isLast: boolean;
  onLanded: (playKey: string) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const landedRef = useRef(onLanded);
  landedRef.current = onLanded;
  const origin = playOriginPoint(fromSeat, localSeat, tableSize, seatCount);
  const center = tableCenter(tableSize);
  const fan = fanSpread(index, count);
  const dim = isPhoneViewport(tableSize.width, tableSize.height) ? FLIGHT_CARD_PHONE : FLIGHT_CARD;
  const startX = origin.x - center.x;
  const startY = origin.y - center.y;
  const midY = startY * 0.45 - 36;
  const visual = visualOffset(fromSeat, localSeat, seatCount);

  useEffect(() => {
    progress.setValue(0);
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: motion.flightMs,
      delay: index * motion.staggerMs,
      easing: Easing.bezier(0.16, 0.84, 0.22, 1),
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
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [startX, fan.x],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 0.45, 1],
                outputRange: [startY, midY, fan.y],
              }),
            },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [startRotate(visual, seatCount), `${fan.rotate}deg`],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.52, 1],
                outputRange: [0.68, 1.18, 1],
              }),
            },
          ],
        },
      ]}
    >
      <CardFace
        card={card}
        size="sm"
        width={dim.width}
        height={dim.height}
        language={language}
        sharedLayout={false}
        elevated
      />
    </Animated.View>
  );
}

export function PlayFlight({
  playKey,
  cards,
  fromSeat,
  localSeat = 0,
  tableSize,
  language,
  seatCount = 4,
  onLanded,
}: Props) {
  if (!tableSize || tableSize.width < 8 || cards.length === 0) {
    return null;
  }
  return (
    <View pointerEvents="none" style={styles.layer}>
      {cards.map((card, index) => (
        <FlyingCard
          key={`${playKey}-${card.id}`}
          card={card}
          index={index}
          count={cards.length}
          fromSeat={fromSeat}
          localSeat={localSeat}
          tableSize={tableSize}
          language={language}
          seatCount={seatCount}
          playKey={playKey}
          isLast={index === cards.length - 1}
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
