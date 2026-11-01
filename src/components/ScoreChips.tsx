import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type ExtraScore = {
  label: string;
  score: number;
  color?: string;
};

type Props = {
  you: number;
  them: number;
  youLabel: string;
  themLabel: string;
  compact?: boolean;
  extra?: ExtraScore;
  youColor?: string;
  themColor?: string;
};

export function ScoreChips({
  you,
  them,
  youLabel,
  themLabel,
  compact = false,
  extra,
  youColor = colors.team1,
  themColor = colors.team2,
}: Props) {
  const extraColor = extra?.color ?? colors.team3;
  return (
    <View
      style={[styles.plaque, compact && styles.plaqueCompact]}
      accessibilityLabel={
        extra
          ? `${youLabel} ${you}, ${themLabel} ${them}, ${extra.label} ${extra.score}`
          : `${youLabel} ${you}, ${themLabel} ${them}`
      }
    >
      <View style={[styles.side, compact && styles.sideCompact]}>
        <Text style={[styles.caption, compact && styles.captionCompact]}>{youLabel}</Text>
        <Text style={[styles.score, compact && styles.scoreCompact, { color: youColor }]}>{you}</Text>
      </View>
      <View style={styles.diamond} />
      <View style={[styles.side, styles.sideEnd, compact && styles.sideCompact]}>
        <Text style={[styles.caption, compact && styles.captionCompact]}>{themLabel}</Text>
        <Text style={[styles.scoreDim, compact && styles.scoreCompact, { color: themColor }]}>{them}</Text>
      </View>
      {extra ? (
        <>
          <View style={styles.diamond} />
          <View style={[styles.side, styles.sideEnd, compact && styles.sideCompact]}>
            <Text style={[styles.caption, compact && styles.captionCompact]}>{extra.label}</Text>
            <Text style={[styles.scoreDim, compact && styles.scoreCompact, { color: extraColor }]}>{extra.score}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plaque: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: colors.glass,
  },
  side: {
    alignItems: 'flex-start',
    minWidth: 44,
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  caption: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  score: {
    color: '#f0e9d9',
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
    fontFamily: fonts.sans,
  },
  scoreDim: {
    color: colors.chipSilver,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
    fontFamily: fonts.sans,
  },
  diamond: {
    width: 4,
    height: 4,
    backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }],
  },
  plaqueCompact: {
    gap: 4,
    minHeight: 18,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  sideCompact: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  captionCompact: {
    fontSize: 6,
    letterSpacing: 0.3,
  },
  scoreCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
});
