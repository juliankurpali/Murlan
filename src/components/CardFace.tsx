import { useEffect, useRef } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet } from 'react-native';
import { Card, rankLabel } from '../domain';
import { Language } from '../application/types';
import { t } from '../i18n';
import {
  MotionPressable,
  MotionView,
  cardFlightTransition,
  cardSelectTransition,
} from '../motion';
import { colors, motion } from '../theme';
import { cardFaceSource } from './cardImages';

type Size = 'sm' | 'md';

type Props = {
  card: Card;
  selected?: boolean;
  legal?: boolean | null;
  size?: Size;
  width?: number;
  height?: number;
  language: Language;
  onPress?: () => void;
  disabled?: boolean;
  tilt?: number;
  elevated?: boolean;
  highlighted?: boolean;
  sharedLayout?: boolean;
  liftOnSelect?: boolean;
  hitWidth?: number;
};

const DIM: Record<Size, { width: number; height: number }> = {
  sm: { width: 52, height: 76 },
  md: { width: 72, height: 104 },
};

function cardLabel(card: Card, language: Language): string {
  if (card.kind === 'joker') {
    return t(language, card.color === 'black' ? 'blackJoker' : 'redJoker');
  }
  const key =
    card.suit === 'spades'
      ? 'ofSpades'
      : card.suit === 'hearts'
        ? 'ofHearts'
        : card.suit === 'diamonds'
          ? 'ofDiamonds'
          : 'ofClubs';
  return t(language, key, { rank: rankLabel(card.rank) });
}

export function CardFace({
  card,
  selected = false,
  legal = null,
  size = 'md',
  width,
  height,
  language,
  onPress,
  disabled = false,
  tilt = 0,
  elevated = false,
  highlighted = false,
  sharedLayout = true,
  liftOnSelect = true,
  hitWidth,
}: Props) {
  const dim = {
    width: width ?? DIM[size].width,
    height: height ?? DIM[size].height,
  };
  const hit = {
    width: hitWidth ?? dim.width,
    height: dim.height,
  };
  const slop = hitWidth === undefined ? 10 : 0;
  const liftAmount = selected && liftOnSelect ? 1 : 0;
  const lift = useRef(new Animated.Value(liftAmount)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    Animated.spring(lift, {
      toValue: liftAmount,
      friction: 5,
      tension: 140,
      useNativeDriver: motion.nativeDriver,
    }).start();
  }, [liftAmount, lift]);

  const cardStyle = [
    styles.card,
    dim,
    selected && styles.selected,
    legal === true && selected && styles.legal,
    legal === false && selected && styles.illegal,
    elevated && styles.elevated,
    highlighted && styles.highlighted,
  ];

  if (Platform.OS === 'web') {
    const face = (
      <MotionView
        layout={sharedLayout}
        layoutId={sharedLayout ? `murlan-card-${card.id.replaceAll('#', '-')}` : undefined}
        initial={false}
        animate={{ y: selected && liftOnSelect ? -14 : 0, scale: 1 }}
        whileHover={onPress && !disabled && !selected ? { y: -4 } : undefined}
        transition={{
          ...cardFlightTransition,
          y: cardSelectTransition,
          scale: cardSelectTransition,
        }}
        style={[...cardStyle, { rotate: `${tilt}deg`, borderRadius: 6 }]}
        pointerEvents="none"
      >
        <Image source={cardFaceSource(card)} style={styles.art} resizeMode="contain" />
      </MotionView>
    );

    if (!onPress) {
      return face;
    }

    return (
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel={cardLabel(card, language)}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        hitSlop={slop}
        whileTap={disabled ? undefined : { scale: 0.96 }}
        transition={cardSelectTransition}
        style={[hit, styles.hit]}
      >
        {face}
      </MotionPressable>
    );
  }

  const inner = (
    <Animated.View
      pointerEvents="none"
      style={[
        cardStyle,
        {
          transform: [
            {
              translateY: lift.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -14],
              }),
            },
            { rotate: `${tilt}deg` },
          ],
        },
      ]}
    >
      <Image source={cardFaceSource(card)} style={styles.art} resizeMode="contain" />
    </Animated.View>
  );

  if (!onPress) {
    return inner;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardLabel(card, language)}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={slop}
      style={[hit, styles.hit]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F4F0E6',
    overflow: 'hidden',
    backgroundColor: '#FFFEF8',
    shadowColor: '#03140C',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
  elevated: {
    shadowOpacity: 0.52,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  highlighted: {
    borderColor: colors.goldHi,
    borderWidth: 2,
    shadowColor: colors.goldHi,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
    backgroundColor: '#FFF8D6',
  },
  selected: {
    borderColor: colors.goldHi,
    borderWidth: 1.5,
    shadowColor: colors.gold,
    shadowOpacity: 0.75,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 14,
  },
  legal: {
    borderColor: colors.good,
  },
  illegal: {
    borderColor: colors.danger,
  },
  art: {
    width: '100%',
    height: '100%',
  },
  hit: {
    overflow: 'visible',
  },
});
