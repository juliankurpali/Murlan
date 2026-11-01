import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Card, Combination, sortPlayCards } from '../domain';
import { Language } from '../application/types';
import { t } from '../i18n';
import { AnimatePresence, MotionView, cardSelectTransition } from '../motion';
import { colors, motion } from '../theme';
import { CardFace } from './CardFace';
import { fanSpread, FLIGHT_CARD, FLIGHT_CARD_PHONE } from './tableLayout';

type Props = {
  language: Language;
  combination: Combination | null;
  prior?: Combination[];
  revealed: boolean;
  originSeat?: number | null;
  playedBy?: string | null;
  compact?: boolean;
};

const PRIOR_MAX = 2;

function cardSize(compact?: boolean): { width: number; height: number } {
  return compact ? FLIGHT_CARD_PHONE : FLIGHT_CARD;
}

function FannedCard({
  card,
  index,
  count,
  language,
  revealed,
  compact,
}: {
  card: Card;
  index: number;
  count: number;
  language: Language;
  revealed: boolean;
  compact?: boolean;
}) {
  const appear = useRef(new Animated.Value(revealed ? 1 : 0)).current;
  const fan = fanSpread(index, count);
  const dim = cardSize(compact);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    Animated.spring(appear, {
      toValue: revealed ? 1 : 0,
      friction: 6,
      tension: 120,
      delay: revealed ? index * 35 : 0,
      useNativeDriver: motion.nativeDriver,
    }).start();
  }, [appear, revealed, index]);

  if (Platform.OS === 'web') {
    return (
      <MotionView
        layout
        initial={{ opacity: 0.7, scale: 0.94, y: fan.y }}
        animate={{ opacity: 1, scale: 1, y: fan.y }}
        exit={{ opacity: 0, scale: 0.7, y: 16 }}
        transition={{
          ...cardSelectTransition,
          delay: index * 0.03,
          opacity: { duration: 0.16 },
        }}
        style={{
          marginLeft: index === 0 ? 0 : compact ? -18 : -16,
          zIndex: index,
          rotate: `${fan.rotate}deg`,
        }}
      >
        <CardFace
          card={card}
          size="sm"
          width={dim.width}
          height={dim.height}
          language={language}
          elevated
        />
      </MotionView>
    );
  }

  return (
    <Animated.View
      style={{
        marginLeft: index === 0 ? 0 : compact ? -18 : -16,
        zIndex: index,
        opacity: appear,
        transform: [
          { rotate: `${fan.rotate}deg` },
          {
            translateY: appear.interpolate({
              inputRange: [0, 1],
              outputRange: [18, fan.y],
            }),
          },
          {
            scale: appear.interpolate({
              inputRange: [0, 1],
              outputRange: [0.86, 1],
            }),
          },
        ],
      }}
    >
      <CardFace
        card={card}
        size="sm"
        width={dim.width}
        height={dim.height}
        language={language}
        elevated
      />
    </Animated.View>
  );
}

function CardFan({
  cards,
  language,
  revealed,
  compact,
  muted = false,
}: {
  cards: Card[];
  language: Language;
  revealed: boolean;
  compact?: boolean;
  muted?: boolean;
}) {
  const dim = cardSize(compact);
  if (muted) {
    return (
      <View style={styles.trickCards} pointerEvents="none">
        {cards.map((card, index) => {
          const fan = fanSpread(index, cards.length);
          return (
            <View
              key={card.id}
              style={{
                marginLeft: index === 0 ? 0 : compact ? -18 : -16,
                zIndex: index,
                transform: [{ rotate: `${fan.rotate}deg` }, { translateY: fan.y }],
              }}
            >
              <CardFace
                card={card}
                size="sm"
                width={dim.width}
                height={dim.height}
                language={language}
                sharedLayout={false}
              />
            </View>
          );
        })}
      </View>
    );
  }
  return (
    <View style={styles.trickCards}>
      <AnimatePresence>
        {cards.map((card, index) => (
          <FannedCard
            key={card.id}
            card={card}
            index={index}
            count={cards.length}
            language={language}
            revealed={revealed}
            compact={compact}
          />
        ))}
      </AnimatePresence>
    </View>
  );
}

export function TrickPile({
  language,
  combination,
  prior = [],
  revealed,
  playedBy = null,
  compact = false,
}: Props) {
  const cards: Card[] = combination ? sortPlayCards(combination.cards, combination.sequence) : [];
  const under = prior.slice(-PRIOR_MAX);
  const glow = useRef(new Animated.Value(cards.length > 0 && revealed ? 1 : 0)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    Animated.timing(glow, {
      toValue: cards.length > 0 && revealed ? 1 : 0,
      duration: 280,
      useNativeDriver: motion.nativeDriver,
    }).start();
  }, [cards.length, revealed, glow]);

  const lit = (cards.length > 0 && revealed) || under.length > 0;
  const heavy = combination?.type === 'bomb' || combination?.type === 'flush';
  const comboKey = cards.map((card) => card.id).join(',');

  return (
    <View style={styles.trick} accessibilityLabel={t(language, 'currentTrick')}>
      {Platform.OS === 'web' ? (
        <>
          <MotionView
            pointerEvents="none"
            animate={{ opacity: lit ? 1 : 0.14, scale: lit ? 1 : 0.78 }}
            transition={cardSelectTransition}
            style={[styles.glow, heavy && styles.glowHeavy]}
          />
          {lit && heavy ? (
            <MotionView
              key={`shock-${comboKey}`}
              pointerEvents="none"
              initial={{ scale: 0.45, opacity: 0.85 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              style={styles.shock}
            />
          ) : null}
        </>
      ) : (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
            },
          ]}
        />
      )}
      <View style={styles.play}>
        {combination && revealed && playedBy ? (
          <View style={styles.playedBy} pointerEvents="none">
            <Text style={styles.playedByName} numberOfLines={1}>
              {playedBy}
            </Text>
          </View>
        ) : null}
        <View style={styles.stack}>
          {under.map((combo, index) => {
            const depth = under.length - index;
            const faded = sortPlayCards(combo.cards, combo.sequence);
            return (
              <View
                key={`prior-${faded.map((card) => card.id).join(',')}`}
                pointerEvents="none"
                style={[
                  styles.underlay,
                  {
                    opacity: depth === 1 ? 0.5 : 0.28,
                    transform: [
                      { translateX: (compact ? -6 : -8) * depth },
                      { translateY: (compact ? 8 : 11) * depth },
                      { rotate: `${-5 * depth}deg` },
                      { scale: 1 - 0.07 * depth },
                    ],
                    zIndex: index,
                  },
                ]}
              >
                <CardFan cards={faded} language={language} revealed compact={compact} muted />
              </View>
            );
          })}
          <View style={styles.current}>
            <CardFan cards={cards} language={language} revealed={revealed} compact={compact} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trick: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'visible',
    position: 'relative',
  },
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stack: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 74,
    minWidth: 56,
  },
  underlay: {
    position: 'absolute',
  },
  current: {
    zIndex: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playedBy: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 6,
    alignItems: 'center',
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(8, 18, 16, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.5)',
    zIndex: 6,
  },
  playedByName: {
    color: colors.goldHi,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 110,
    borderRadius: 100,
    backgroundColor: 'rgba(200, 193, 161, 0.1)',
  },
  glowHeavy: {
    backgroundColor: 'rgba(200, 193, 161, 0.18)',
  },
  shock: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  trickCards: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 74,
    paddingHorizontal: 12,
    position: 'relative',
  },
});
