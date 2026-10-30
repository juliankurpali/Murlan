import { StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  accent: string;
  tone?: number;
};

const TONES = [
  { bg: '#1b2a30', glow: 'rgba(180, 200, 196, 0.06)', skin: '#c4a078', cloth: '#31444c' },
  { bg: '#24343a', glow: 'rgba(225, 178, 146, 0.08)', skin: '#d2b7a0', cloth: '#4a6570' },
  { bg: '#1f2e28', glow: 'rgba(196, 210, 180, 0.08)', skin: '#cbb089', cloth: '#3a5248' },
  { bg: '#2a2834', glow: 'rgba(180, 176, 210, 0.08)', skin: '#c9a990', cloth: '#3d3a52' },
] as const;

export function PlayerAvatar({ size = 52, accent, tone = 0 }: Props) {
  const palette = TONES[Math.abs(tone) % TONES.length] ?? TONES[0];
  const head = Math.round(size * 0.38);
  const torsoW = Math.round(size * 0.74);
  const torsoH = Math.round(size * 0.42);

  return (
    <View
      accessibilityLabel="player avatar"
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          backgroundColor: palette.bg,
          borderColor: accent,
        },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          width: Math.round(size * 0.7),
          height: Math.round(size * 0.7),
          borderRadius: size,
          backgroundColor: palette.glow,
          top: -size * 0.12,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: head,
          height: head,
          borderRadius: head / 2,
          backgroundColor: palette.skin,
          top: size * 0.16,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: torsoW,
          height: torsoH,
          borderTopLeftRadius: torsoW / 2,
          borderTopRightRadius: torsoW / 2,
          backgroundColor: palette.cloth,
          bottom: -2,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
  },
});
