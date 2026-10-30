import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { LandscapeFrame, LandscapePane } from '../components/LandscapeFrame';
import { MatchHistoryRow, PublicPlayer } from '../platform/types';
import { t } from '../i18n';
import { colors, fonts, radius, spacing } from '../theme';

type Props = {
  language: Language;
  player: PublicPlayer | null;
  history: MatchHistoryRow[];
  friends: PublicPlayer[];
  onBack: () => void;
};

export function ProfileScreen({ language, player, history, friends, onBack }: Props) {
  return (
    <LandscapeFrame title={t(language, 'profile')} backLabel={t(language, 'back')} onBack={onBack}>
      <LandscapePane>
        <View style={styles.pane}>
          <Text style={styles.name}>{player?.username ?? t(language, 'guestAccount')}</Text>
          <Text style={styles.meta}>{t(language, 'identityHint')}</Text>
          <View style={styles.stats}>
            <Stat label={t(language, 'gamesPlayed')} value={player?.gamesPlayed ?? 0} />
            <Stat label={t(language, 'gamesWon')} value={player?.wins ?? 0} />
            <Stat label={t(language, 'gamesLost')} value={player?.losses ?? 0} />
            <Stat label={t(language, 'winPct')} value={`${player?.winPct ?? 0}%`} />
            <Stat label={t(language, 'teamStats')} value={player?.teamWins ?? 0} />
            <Stat label={t(language, 'individualStats')} value={player?.individualWins ?? 0} />
          </View>
        </View>
      </LandscapePane>
      <LandscapePane>
        <ScrollView contentContainerStyle={styles.pane} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>{t(language, 'matchHistory')}</Text>
          {history.length === 0 ? <Text style={styles.meta}>{t(language, 'noActiveGames')}</Text> : null}
          {history.map((row) => (
            <Text key={row.id} style={styles.row}>
              {row.won ? t(language, 'gamesWon') : t(language, 'gamesLost')} · {row.mode} · {row.score}
            </Text>
          ))}
          <Text style={styles.label}>{t(language, 'friends')}</Text>
          {friends.map((friend) => (
            <Text key={friend.id} style={styles.row}>
              {friend.username} · {friend.online ? t(language, 'onlineNow') : t(language, 'offline')}
            </Text>
          ))}
        </ScrollView>
      </LandscapePane>
    </LandscapeFrame>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  name: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stat: {
    width: '30%',
    flexGrow: 1,
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 8,
  },
  statValue: {
    color: colors.cream,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
  },
  label: {
    color: colors.cream,
    fontWeight: '700',
  },
  row: {
    color: colors.muted,
    fontSize: 13,
  },
});
