import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { ConnectionState } from '../online/lifecycle';
import { colors, fonts, motion } from '../theme';
import { PlayerAvatar } from './PlayerAvatar';
import { VoiceMic } from './VoiceMic';

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
  timerAbove?: boolean;
  turnDurationMs?: number;
  turnToken?: string;
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
  teamLabel,
  size = 36,
  spotlight = false,
  dimmed = false,
  voice = null,
  connectionLabel = null,
  turnLabel = null,
  timerAbove = true,
  turnDurationMs = motion.humanTurnMs,
  turnToken = '',
  place = null,
  placeLabel = null,
}: Props) {
  const ring = size + 4;
  const fill = useRef(new Animated.Value(1)).current;
  const [trackWidth, setTrackWidth] = useState(72);
  const [urgentTurn, setUrgentTurn] = useState(false);
  const timer = isTurn ? (
    <View
      style={styles.barTrack}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (next > 0) {
          setTrackWidth(next);
        }
      }}
    >
      <Animated.View
        style={[
          styles.barFill,
          urgentTurn && styles.barUrgent,
          {
            width: fill.interpolate({
              inputRange: [0, 1],
              outputRange: [0, Math.max(trackWidth, 1)],
            }),
          },
        ]}
      />
    </View>
  ) : null;
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    fill.stopAnimation();
    if (!isTurn) {
      fill.setValue(1);
      setUrgentTurn(false);
      return;
    }
    fill.setValue(1);
    setUrgentTurn(false);
    const duration = Math.max(400, turnDurationMs);
    const cutoff = 5000 / duration;
    let lastUrgent = false;
    const sub = fill.addListener(({ value }) => {
      const next = value <= cutoff;
      if (next === lastUrgent) {
        return;
      }
      lastUrgent = next;
      setUrgentTurn(next);
    });
    const anim = Animated.timing(fill, {
      toValue: 0,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start();
    return () => {
      anim.stop();
      fill.removeListener(sub);
    };
  }, [isTurn, turnToken, turnDurationMs, fill]);
  const lit = isTurn || spotlight;

  useEffect(() => {
    if (!lit || Platform.OS === 'web') {
      pulse.setValue(lit ? 1 : 0.55);
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

  return (
    <Animated.View
      style={[
        styles.chip,
        (passed || dimmed) && !isTurn && !place && styles.faded,
        spotlight && !isTurn && styles.spotlight,
        isTurn && styles.turnGlow,
        lit &&
          Platform.OS !== 'web' && {
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
        {timerAbove ? timer : null}
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
        {timerAbove ? null : timer}
        {teamLabel ? (
          <Text style={[styles.team, { color: seatAccent }]} numberOfLines={1}>
            {teamLabel}
          </Text>
        ) : turnLabel && !isTurn ? (
          <Text style={styles.turnMark} numberOfLines={1}>
            {turnLabel}
          </Text>
        ) : null}
        {connectionLabel ? (
          <Text style={styles.link} numberOfLines={1}>
            {connectionLabel}
          </Text>
        ) : null}
      </View>
      {voice ? (
        <VoiceMic
          muted={voice.muted}
          speaking={voice.speaking}
          canControl={voice.canControl}
          available={voice.available}
          onToggle={voice.onToggle}
          accessibilityLabel={
            voice.muted
              ? 'mic off'
              : voice.available === false
                ? 'mic unavailable'
                : voice.speaking
                  ? 'mic live'
                  : 'mic on'
          }
        />
      ) : null}
    </Animated.View>
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
    alignItems: 'stretch',
    minWidth: 64,
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
  barTrack: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    marginBottom: 3,
    marginTop: 1,
  },
  barFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.goldHi,
  },
  barUrgent: {
    backgroundColor: colors.danger,
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
  link: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
