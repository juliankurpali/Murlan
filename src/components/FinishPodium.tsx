import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { SeatAppearance } from '../application/players';
import { Language } from '../application/types';
import { PublicMatchView, SeatId } from '../domain';
import { seatName, t } from '../i18n';
import { colors, fonts, motion, radius, seatToken } from '../theme';
import { PlayerAvatar } from './PlayerAvatar';

const PLACE_KEYS = ['first', 'second', 'third', 'last'] as const;
const MEDAL = ['#e8d7a3', '#c5cdc9', '#c49a72', '#5d6c6a'] as const;
const BAR_H = [52, 40, 32, 24];
const DISPLAY = [1, 0, 2, 3];

type Props = {
  view: PublicMatchView;
  language: Language;
  appearances: SeatAppearance[];
};

function PodiumColumn({
  seat,
  place,
  view,
  language,
  appearance,
  delay,
}: {
  seat: SeatId;
  place: number;
  view: PublicMatchView;
  language: Language;
  appearance: SeatAppearance;
  delay: number;
}) {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    rise.setValue(0);
    Animated.timing(rise, {
      toValue: 1,
      duration: 620,
      delay,
      easing: Easing.bezier(0.16, 0.84, 0.18, 1),
      useNativeDriver: motion.nativeDriver,
    }).start();
  }, [delay, rise, seat]);

  const height = BAR_H[place] ?? 36;
  const medal = MEDAL[place] ?? MEDAL[3];
  const points = view.lastHandPoints?.[seat] ?? 0;

  return (
    <Animated.View
      style={[
        styles.col,
        place === 0 && styles.colFirst,
        {
          opacity: rise,
          transform: [
            {
              translateY: rise.interpolate({
                inputRange: [0, 1],
                outputRange: [28, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.medal, { backgroundColor: medal }]}>
        <Text style={styles.medalText}>{place + 1}</Text>
      </View>
      <View style={[styles.avatar, { borderColor: medal }]}>
        {appearance.profileUri ? (
          <Image source={{ uri: appearance.profileUri }} style={styles.photo} />
        ) : (
          <PlayerAvatar size={32} accent={seatToken[seat]} tone={appearance.tone} />
        )}
      </View>
      <Text style={styles.place}>{t(language, PLACE_KEYS[place] ?? 'last')}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {seatName(language, seat)}
      </Text>
      <Text style={styles.total}>{view.scores[seat]}</Text>
      <View style={[styles.bar, { height, backgroundColor: medal }]}>
        <Text style={styles.pts}>+{points}</Text>
      </View>
    </Animated.View>
  );
}

export function FinishPodium({ view, language, appearances }: Props) {
  const order = (
    view.finishOrder.length === 4
      ? view.finishOrder
      : ([...view.finishOrder, ...([0, 1, 2, 3] as SeatId[]).filter((seat) => !view.finishOrder.includes(seat))] as SeatId[])
  );

  return (
    <View style={styles.row}>
      {DISPLAY.map((place, visualIndex) => {
        const seat = order[place] ?? (place as SeatId);
        return (
          <PodiumColumn
            key={seat}
            seat={seat}
            place={place}
            view={view}
            language={language}
            appearance={appearances[seat] ?? { profileUri: null, tone: 0 }}
            delay={120 + visualIndex * 90}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    minHeight: 156,
    marginVertical: 0,
  },
  col: {
    alignItems: 'center',
    width: 70,
    gap: 4,
  },
  colFirst: {
    marginBottom: 6,
  },
  medal: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  medalText: {
    color: '#182128',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: '#1b2a30',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  place: {
    color: colors.goldHi,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  name: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.sans,
    maxWidth: 68,
    textAlign: 'center',
  },
  total: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  pts: {
    color: '#182128',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
});
