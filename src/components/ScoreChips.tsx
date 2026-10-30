import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = {
  you: number;
  them: number;
  target: number;
  youLabel: string;
  themLabel: string;
  targetLabel: string;
  compact?: boolean;
};

export function ScoreChips({ you, them, target, youLabel, themLabel, targetLabel, compact = false }: Props) {
  return (
    <View
      style={[styles.plaque, compact && styles.plaqueCompact]}
      accessibilityLabel={`${youLabel} ${you}, ${themLabel} ${them}, ${targetLabel}`}
    >
      <View style={[styles.side, compact && styles.sideCompact]}>
        <Text style={[styles.caption, compact && styles.captionCompact]}>{youLabel}</Text>
        <Text style={[styles.score, compact && styles.scoreCompact, { color: colors.team1 }]}>{you}</Text>
      </View>
      <View style={styles.mid}>
        <View style={styles.diamond} />
        <Text style={[styles.targetNum, compact && styles.targetCompact]}>{target}</Text>
        <View style={styles.diamond} />
      </View>
      <View style={[styles.side, styles.sideEnd, compact && styles.sideCompact]}>
        <Text style={[styles.caption, compact && styles.captionCompact]}>{themLabel}</Text>
        <Text style={[styles.scoreDim, compact && styles.scoreCompact, { color: colors.team2 }]}>{them}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plaque: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: colors.glass,
  },
  side: {
    alignItems: 'flex-start',
    minWidth: 52,
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  caption: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  score: {
    color: '#f0e9d9',
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
    fontFamily: fonts.sans,
  },
  scoreDim: {
    color: colors.chipSilver,
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
    fontFamily: fonts.sans,
  },
  mid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetNum: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
    fontFamily: fonts.sans,
  },
  diamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.gold,
    transform: [{ rotate: '45deg' }],
  },
  plaqueCompact: {
    gap: 5,
    minHeight: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sideCompact: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  captionCompact: {
    fontSize: 7,
    letterSpacing: 0.4,
  },
  scoreCompact: {
    fontSize: 12,
    lineHeight: 14,
  },
  targetCompact: {
    fontSize: 9,
  },
});
