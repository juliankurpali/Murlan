import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Language } from '../application/types';
import { t } from '../i18n';
import { colors, hitSlop, motion } from '../theme';

export type VoiceMicState = {
  muted: boolean;
  speaking: boolean;
  canControl: boolean;
  available?: boolean;
  onToggle?: () => void;
};

export function voiceMicLabel(language: Language, voice: VoiceMicState): string {
  if (voice.muted) {
    return t(language, 'voiceOff');
  }
  if (voice.available === false) {
    return t(language, 'voiceUnavailable');
  }
  if (voice.speaking) {
    return t(language, 'voiceLive');
  }
  return t(language, 'voiceOn');
}

export function VoiceMic({
  muted,
  speaking,
  canControl,
  available = true,
  onToggle,
  accessibilityLabel,
}: VoiceMicState & { accessibilityLabel: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const live = !muted && available !== false;
  const talking = Boolean(live && speaking);

  useEffect(() => {
    if (!talking || Platform.OS === 'web') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.16,
          duration: 220,
          useNativeDriver: motion.nativeDriver,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 220,
          useNativeDriver: motion.nativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [talking, pulse]);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !canControl, selected: live }}
        disabled={!canControl}
        onPress={canControl ? onToggle : undefined}
        hitSlop={hitSlop}
        style={[
          styles.mic,
          live && styles.micOn,
          talking && styles.micTalk,
          muted && styles.micMuted,
          available === false && !muted && styles.micMissing,
          !canControl && styles.micLocked,
        ]}
      >
        <MicGlyph live={live} talking={talking} muted={muted} />
        {talking ? (
          <View style={styles.levels} pointerEvents="none">
            <View style={[styles.bar, styles.barLow]} />
            <View style={[styles.bar, styles.barMid]} />
            <View style={[styles.bar, styles.barHigh]} />
          </View>
        ) : null}
      </Pressable>
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
