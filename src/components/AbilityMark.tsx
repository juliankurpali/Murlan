import { StyleSheet, Text, View } from 'react-native';
import { ChaosAbilityId } from '../domain';
import { colors, fonts } from '../theme';

export const ABILITY_GLYPH: Record<ChaosAbilityId, string> = {
  mindReader: '👁',
  freeze: '❄',
  cardThief: '⇆',
  shield: '🛡',
  secondChance: '✚',
  jokerKing: '♛',
  wildCard: '✦',
  lastManStanding: '☠',
};

type Props = {
  glyph: string;
  consumed?: boolean;
  mystery?: boolean;
};

export function AbilityMark({ glyph, consumed = false, mystery = false }: Props) {
  return (
    <View style={[styles.mark, consumed && styles.consumed, mystery && styles.mystery]}>
      <Text style={styles.glyph}>{glyph}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 197, 71, 0.22)',
    borderWidth: 1,
    borderColor: colors.goldHi,
    paddingHorizontal: 3,
  },
  mystery: {
    backgroundColor: 'rgba(8, 16, 18, 0.72)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  consumed: {
    opacity: 0.38,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  glyph: {
    color: colors.goldHi,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fonts.sans,
    lineHeight: 12,
  },
});
