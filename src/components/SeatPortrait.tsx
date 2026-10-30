import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ConnectionState } from '../online/lifecycle';
import { colors, fonts, hitSlop, motion } from '../theme';
import { PlayerAvatar } from './PlayerAvatar';
import { TurnClock } from './TurnClock';

type Props = {
  name: string;
  profileUri: string | null;
  tone?: number;
  seatAccent: string;
  isTurn: boolean;
  passed: boolean;
  finished: boolean;
  lastPlayed: boolean;
  partner?: boolean;
  turnProgress: number;
  teamLabel: string | null;
  size?: number;
  spotlight?: boolean;
  dimmed?: boolean;
  voice?: {
    muted: boolean;
    speaking: boolean;
    canControl: boolean;
    available?: boolean;
    connection?: ConnectionState;
    onToggle?: () => void;
  } | null;
  connectionLabel?: string | null;
  turnLabel?: string | null;
  place?: number | null;
  placeLabel?: string | null;
};

export function SeatPortrait({
  name,
  profileUri,
  tone = 0,
  seatAccent,
  isTurn,
  passed,
  finished,
  lastPlayed,
  partner,
  turnProgress,
  teamLabel,
  size = 36,
  spotlight = false,
  dimmed = false,
  voice = null,
  connectionLabel = null,
  turnLabel = null,
  place = null,
  placeLabel = null,
}: Props) {
  const ring = size + 4;
  const pulse = useRef(new Animated.Value(0.55)).current;
  const micPulse = useRef(new Animated.Value(1)).current;
  const live = Boolean(voice && !voice.muted && voice.available !== false);
  const talking = Boolean(live && voice?.speaking);
  const lit = isTurn || spotlight;

  useEffect(() => {
    if (!lit) {
      pulse.setValue(0.55);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 640,
          useNativeDriver: motion.nativeDriver,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 640,
          useNativeDriver: motion.nativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lit, pulse]);

  useEffect(() => {
    if (!talking) {
      micPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, {
          toValue: 1.16,
          duration: 220,
          useNativeDriver: motion.nativeDriver,
        }),
        Animated.timing(micPulse, {
          toValue: 1,
          duration: 220,
          useNativeDriver: motion.nativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [talking, micPulse]);

  const micLabel = !voice
    ? ''
    : voice.muted
      ? 'mic off'
      : voice.available === false
        ? 'mic unavailable'
        : talking
          ? 'mic live'
          : 'mic on';

  return (
    <Animated.View
      style={[
        styles.chip,
        (passed || dimmed) && !isTurn && !place && styles.faded,
        spotlight && !isTurn && styles.spotlight,
        isTurn && styles.turnGlow,
        lit && {
          opacity: pulse.interpolate({ inputRange: [0.45, 1], outputRange: [0.9, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0.45, 1], outputRange: [1, isTurn ? 1.08 : 1.06] }) }],
        },
      ]}
    >
      <View style={[styles.avatarBox, { width: ring, height: ring }]}>
        {isTurn ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              {
                width: ring + 10,
                height: ring + 10,
                borderRadius: (ring + 10) / 2,
                opacity: pulse.interpolate({ inputRange: [0.45, 1], outputRange: [0.35, 0.9] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0.45, 1], outputRange: [1, 1.08] }) }],
              },
            ]}
          />
        ) : null}
        {isTurn ? <TurnClock progress={turnProgress} size={ring} /> : null}
        <View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: isTurn ? colors.goldHi : spotlight || partner ? colors.gold : seatAccent,
              borderWidth: isTurn ? 2.5 : 2,
            },
            lastPlayed && styles.lastPlayed,
          ]}
        >
          {profileUri ? (
            <Image source={{ uri: profileUri }} style={styles.photo} />
          ) : (
            <PlayerAvatar size={size - 4} accent={seatAccent} tone={tone} />
          )}
        </View>
      </View>
      <View style={styles.meta}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isTurn && styles.nameTurn]} numberOfLines={1}>
            {name}
          </Text>
          {place && placeLabel ? (
            <View style={[styles.placeChip, place === 1 && styles.placeFirst]}>
              <Text style={styles.placeText}>{placeLabel}</Text>
            </View>
          ) : null}
        </View>
        {turnLabel ? (
          <Text style={styles.turnMark} numberOfLines={1}>
            {turnLabel}
          </Text>
        ) : teamLabel ? (
          <Text style={[styles.team, { color: seatAccent }]} numberOfLines={1}>
            {teamLabel}
          </Text>
        ) : null}
        {connectionLabel ? (
          <Text style={styles.link} numberOfLines={1}>
            {connectionLabel}
          </Text>
        ) : null}
      </View>
      {voice ? (
        <Animated.View style={{ transform: [{ scale: micPulse }] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={micLabel}
            accessibilityState={{ disabled: !voice.canControl, selected: live }}
            disabled={!voice.canControl}
            onPress={voice.canControl ? voice.onToggle : undefined}
            hitSlop={hitSlop}
            style={[
              styles.mic,
              live && styles.micOn,
              talking && styles.micTalk,
              voice.muted && styles.micMuted,
              voice.available === false && !voice.muted && styles.micMissing,
              !voice.canControl && styles.micLocked,
            ]}
          >
            <MicGlyph live={live} talking={talking} muted={voice.muted} />
            {talking ? (
              <View style={styles.levels} pointerEvents="none">
                <View style={[styles.bar, styles.barLow]} />
                <View style={[styles.bar, styles.barMid]} />
                <View style={[styles.bar, styles.barHigh]} />
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function MicGlyph({ live, talking, muted }: { live: boolean; talking: boolean; muted: boolean }) {
  const ink = muted ? colors.muted : talking ? colors.goldHi : live ? colors.good : colors.cream;
  return (
    <View style={styles.glyph}>
      <View style={[styles.capsule, { backgroundColor: ink }]} />
      <View style={[styles.yoke, { borderColor: ink }]} />
      <View style={[styles.stem, { backgroundColor: ink }]} />
      <View style={[styles.foot, { backgroundColor: ink }]} />
      {muted ? <View style={styles.slash} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(8, 18, 16, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  spotlight: {
    borderColor: colors.goldHi,
    borderWidth: 1.5,
    shadowColor: colors.gold,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: 'rgba(40, 32, 8, 0.88)',
  },
  turnGlow: {
    borderColor: colors.goldHi,
    borderWidth: 2,
    backgroundColor: 'rgba(58, 44, 6, 0.96)',
    shadowColor: colors.goldHi,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  halo: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: colors.goldHi,
    backgroundColor: 'rgba(232, 197, 71, 0.22)',
    shadowColor: colors.gold,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  faded: {
    opacity: 0.42,
  },
  avatarBox: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderRadius: 999,
  },
  ring: {
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: '#12302a',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  meta: {
    alignItems: 'flex-start',
    minWidth: 52,
    paddingRight: 4,
  },
  name: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.sans,
    flexShrink: 1,
  },
  nameTurn: {
    color: colors.goldHi,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 88,
  },
  placeChip: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  placeFirst: {
    backgroundColor: 'rgba(232, 197, 71, 0.28)',
    borderColor: colors.goldHi,
  },
  placeText: {
    color: colors.goldHi,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    fontFamily: fonts.sans,
  },
  turnMark: {
    color: colors.goldHi,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  team: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  lastPlayed: {
    shadowColor: colors.gold,
    shadowOpacity: 0.55,
    shadowRadius: 8,
  },
  mic: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(12, 20, 18, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  micOn: {
    borderColor: colors.good,
    backgroundColor: 'rgba(46, 204, 113, 0.22)',
  },
  micTalk: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(232, 197, 71, 0.32)',
    shadowColor: colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  link: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  micMuted: {
    borderColor: 'rgba(224, 91, 76, 0.7)',
    backgroundColor: 'rgba(224, 91, 76, 0.12)',
  },
  micMissing: {
    borderColor: colors.danger,
    opacity: 0.8,
  },
  micLocked: {
    opacity: 0.85,
  },
  glyph: {
    width: 12,
    height: 16,
    alignItems: 'center',
  },
  capsule: {
    width: 7,
    height: 9,
    borderRadius: 4,
  },
  yoke: {
    position: 'absolute',
    top: 4,
    width: 11,
    height: 7,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  stem: {
    position: 'absolute',
    top: 11,
    width: 1.5,
    height: 3,
    borderRadius: 1,
  },
  foot: {
    position: 'absolute',
    top: 14,
    width: 8,
    height: 1.5,
    borderRadius: 1,
  },
  slash: {
    position: 'absolute',
    top: 2,
    left: 5,
    width: 1.6,
    height: 13,
    borderRadius: 1,
    backgroundColor: colors.danger,
    transform: [{ rotate: '28deg' }],
  },
  levels: {
    position: 'absolute',
    right: -5,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    height: 10,
  },
  bar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.goldHi,
  },
  barLow: {
    height: 4,
  },
  barMid: {
    height: 7,
  },
  barHigh: {
    height: 10,
  },
});
