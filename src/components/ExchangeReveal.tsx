import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { Card, CardExchangeResult } from '../domain';
import { t } from '../i18n';
import { AnimatePresence, MotionView } from '../motion';
import { colors, motion } from '../theme';
import { CardFace } from './CardFace';

type Props = {
  exchange: CardExchangeResult;
  language: Language;
  visible: boolean;
  incomingOnly?: boolean;
};

function SwapCards({
  incoming,
  outgoing,
  language,
}: {
  incoming: Card;
  outgoing: Card | null;
  language: Language;
}) {
  return (
    <>
      <CardFace card={incoming} size="md" language={language} sharedLayout={false} elevated />
      {outgoing ? (
        <>
          <View style={styles.swap} />
          <CardFace card={outgoing} size="sm" language={language} sharedLayout={false} elevated />
        </>
      ) : null}
    </>
  );
}

export function ExchangeReveal({ exchange, language, visible, incomingOnly = false }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;
  const swapKey =
    exchange.kind === 'swap'
      ? `${exchange.givenToFirst.id}-${incomingOnly ? 'in' : exchange.returnedToLast.id}`
      : `skip-${exchange.reason}`;

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    if (!visible) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: motion.nativeDriver,
      }).start();
      return;
    }
    opacity.setValue(0);
    rise.setValue(18);
    Animated.parallel([
      Animated.spring(opacity, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: motion.nativeDriver,
      }),
      Animated.spring(rise, {
        toValue: 0,
        friction: 6,
        tension: 90,
        useNativeDriver: motion.nativeDriver,
      }),
    ]).start();
  }, [visible, swapKey, opacity, rise]);

  const body =
    exchange.kind === 'skipped' ? (
      <Text style={styles.skip}>{t(language, 'exchangeSkipped')}</Text>
    ) : (
      <SwapCards
        incoming={exchange.givenToFirst}
        outgoing={incomingOnly ? null : exchange.returnedToLast}
        language={language}
      />
    );

  if (Platform.OS === 'web') {
    return (
      <AnimatePresence>
        {visible ? (
          <MotionView
            key={swapKey}
            pointerEvents="none"
            initial={{ opacity: 0, y: -18, scale: 0.86 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -22, scale: 0.9 }}
            transition={{ type: 'spring', bounce: 0.22, visualDuration: 0.45 }}
            style={styles.overlay}
          >
            {body}
          </MotionView>
        ) : null}
      </AnimatePresence>
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity, transform: [{ translateY: rise }] }]}>
      {body}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: '16%',
    gap: 14,
  },
  swap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    transform: [{ rotate: '45deg' }],
  },
  skip: {
    color: colors.goldHi,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    maxWidth: 220,
  },
});
