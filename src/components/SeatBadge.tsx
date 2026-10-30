import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { seatName, t } from '../i18n';
import { colors, motion, radius } from '../theme';

type Props = {
  seat: 0 | 1 | 2 | 3;
  language: Language;
  cardCount: number;
  isTurn: boolean;
  passed: boolean;
  finished: boolean;
  lastPlayed?: boolean;
  partner?: boolean;
  compact?: boolean;
};

function ThinkingDots({ active }: { active: boolean }) {
  const a = useRef(new Animated.Value(0.3)).current;
  const b = useRef(new Animated.Value(0.3)).current;
  const c = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!active) {
      a.setValue(0.3);
      b.setValue(0.3);
      c.setValue(0.3);
      return;
    }
    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 280, useNativeDriver: motion.nativeDriver }),
          Animated.timing(value, { toValue: 0.3, duration: 280, useNativeDriver: motion.nativeDriver }),
          Animated.delay(240),
        ]),
      );
    const run = Animated.parallel([pulse(a, 0), pulse(b, 140), pulse(c, 280)]);
    run.start();
    return () => run.stop();
  }, [active, a, b, c]);

  if (!active) {
    return null;
  }
  return (
    <View style={styles.dots}>
      <Animated.View style={[styles.dot, { opacity: a }]} />
      <Animated.View style={[styles.dot, { opacity: b }]} />
      <Animated.View style={[styles.dot, { opacity: c }]} />
    </View>
  );
}

export function SeatBadge({
  seat,
  language,
  cardCount,
  isTurn,
  passed,
  finished,
  lastPlayed = false,
  partner,
  compact,
}: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(isTurn ? 1 : 0)).current;
  const tag = useRef(new Animated.Value(lastPlayed ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glow, {
      toValue: isTurn ? 1 : 0,
      duration: 240,
      useNativeDriver: motion.nativeDriver,
    }).start();
    if (!isTurn) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 720,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.nativeDriver,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.nativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isTurn, pulse, glow]);

  useEffect(() => {
    Animated.spring(tag, {
      toValue: lastPlayed ? 1 : 0,
      friction: 5,
      tension: 160,
      useNativeDriver: motion.nativeDriver,
    }).start();
  }, [lastPlayed, tag]);

  const status = finished
    ? t(language, 'finished')
    : passed
      ? t(language, 'passed')
      : t(language, 'cardsLeft', { count: cardCount });

  return (
    <Animated.View
      accessibilityLabel={`${seatName(language, seat)}, ${status}${lastPlayed ? `, ${t(language, 'lastPlayed')}` : ''}`}
      style={[
        styles.badge,
        isTurn && styles.turn,
        lastPlayed && !isTurn && styles.lastPlayedSeat,
        partner && styles.partner,
        compact && styles.compact,
        { transform: [{ scale: pulse }] },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            opacity: glow,
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.tag,
          {
            opacity: tag,
            transform: [
              {
                scale: tag.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
              },
              {
                translateY: tag.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.tagText}>{t(language, 'lastPlayed')}</Text>
      </Animated.View>
      <Text style={styles.name}>{seatName(language, seat)}</Text>
      <View style={styles.metaRow}>
        <Text style={[styles.meta, passed && styles.passed]}>{status}</Text>
        <ThinkingDots active={isTurn && seat !== 0 && !finished} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.feltDark,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 8,
    minWidth: 104,
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.feltLight,
    overflow: 'visible',
  },
  compact: {
    minWidth: 90,
    paddingHorizontal: 8,
  },
  turn: {
    borderColor: colors.gold,
    borderWidth: 2,
    backgroundColor: '#163F31',
  },
  lastPlayedSeat: {
    borderColor: '#F3D48A',
    shadowColor: colors.gold,
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  partner: {
    backgroundColor: '#1A4A38',
  },
  halo: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(227, 195, 111, 0.45)',
  },
  tag: {
    position: 'absolute',
    top: 5,
    left: 8,
    backgroundColor: colors.gold,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    zIndex: 4,
  },
  tagText: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  name: {
    color: colors.cream,
    fontWeight: '800',
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  meta: {
    color: colors.seatOpp,
    fontSize: 12,
  },
  passed: {
    color: '#E8C98A',
    fontWeight: '700',
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
});
