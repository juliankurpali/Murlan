import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SeatId } from '../domain';
import { motion } from '../theme';
import { CardBack } from './CardBack';
import { seatPoint, tableCenter, TableSize } from './tableLayout';

const DEAL_N = 16;
const CARD = { width: 32, height: 46 };

type Props = {
  dealKey: string;
  tableSize: TableSize | null;
  seatCount?: number;
  onDone: (dealKey: string) => void;
};

function FlyingDealCard({
  index,
  tableSize,
  dealKey,
  seatCount,
  isLast,
  onDone,
}: {
  index: number;
  tableSize: TableSize;
  dealKey: string;
  seatCount: number;
  isLast: boolean;
  onDone: (dealKey: string) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const seat = (index % seatCount) as SeatId;
  const origin = tableCenter(tableSize);
  const dest = seatPoint(seat, tableSize, seatCount);
  const startX = 0;
  const startY = 0;
  const endX = dest.x - origin.x;
  const endY = dest.y - origin.y;
  const midY = (endY) * 0.45 - 36;
  const spin =
    seat === 1 ? '-28deg' : seat === 3 ? '28deg' : seat === 2 ? '12deg' : '-8deg';

  useEffect(() => {
    progress.setValue(0);
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: 480,
      delay: 80 + index * 52,
      easing: Easing.bezier(0.16, 0.84, 0.22, 1),
      useNativeDriver: motion.nativeDriver,
    });
    run.start(({ finished }) => {
      if (finished && isLast) {
        doneRef.current(dealKey);
      }
    });
    return () => run.stop();
  }, [dealKey, index, isLast, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.card,
        {
          left: origin.x - CARD.width / 2,
          top: origin.y - CARD.height / 2,
          zIndex: 40 + index,
          opacity: progress.interpolate({
            inputRange: [0, 0.12, 0.82, 1],
            outputRange: [0, 1, 1, 0],
          }),
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [startX, endX],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 0.42, 1],
                outputRange: [startY, midY, endY],
              }),
            },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['-8deg', spin],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0.86, 1.08, 0.72],
              }),
            },
          ],
        },
      ]}
    >
      <CardBack size="sm" />
    </Animated.View>
  );
}

export function DealFlight({ dealKey, tableSize, seatCount = 4, onDone }: Props) {
  const pile = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    pile.setValue(1);
    const run = Animated.timing(pile, {
      toValue: 0,
      duration: motion.dealMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: motion.nativeDriver,
    });
    run.start();
    const fallback = setTimeout(() => onDone(dealKey), motion.dealMs + 120);
    return () => {
      run.stop();
      clearTimeout(fallback);
    };
  }, [dealKey, onDone, pile]);

  if (!tableSize || tableSize.width < 8) {
    return null;
  }

  const origin = tableCenter(tableSize);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 7 }, (_, index) => (
        <Animated.View
          key={`pile-${index}`}
          style={[
            styles.card,
            {
              left: origin.x - CARD.width / 2 + index * 0.7,
              top: origin.y - CARD.height / 2 - index * 1.2,
              zIndex: 39 - index,
              opacity: pile,
              transform: [
                { rotate: `${(index - 3) * 1.4}deg` },
                {
                  scale: pile.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <CardBack size="sm" />
        </Animated.View>
      ))}
      {Array.from({ length: DEAL_N }, (_, index) => (
        <FlyingDealCard
          key={`${dealKey}-${index}`}
          index={index}
          tableSize={tableSize}
          dealKey={dealKey}
          seatCount={seatCount}
          isLast={index === DEAL_N - 1}
          onDone={onDone}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
  },
});
