import { Image, StyleSheet, Text, View } from 'react-native';
import { SeatAppearance, appearanceForSeat } from '../application/players';
import { Language } from '../application/types';
import { LandscapeFrame } from '../components/LandscapeFrame';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { UiButton } from '../components/UiButton';
import { placeForSeat, PublicMatchView, SeatId } from '../domain';
import { seatName, t } from '../i18n';
import { colors, fonts, seatToken, spacing } from '../theme';

const PLACE_KEYS = ['first', 'second', 'third', 'fourth'] as const;
const TEAM_SEATS: [SeatId[], SeatId[]] = [
  [0, 2],
  [1, 3],
];

type Props = {
  language: Language;
  view: PublicMatchView;
  humanAppearance: SeatAppearance;
  localSeat?: SeatId;
  names?: Array<string | undefined>;
  onNextHand: () => void;
  onMenu: () => void;
  onPlayAgain: () => void;
  nextHandReady?: boolean;
  waitingFor?: string | null;
};

function winnerText(view: PublicMatchView, language: Language, localSeat: SeatId): string {
  if (view.winner === 'team0') {
    return t(language, localSeat % 2 === 0 ? 'winnerTeamYou' : 'winnerTeamOpp');
  }
  if (view.winner === 'team1') {
    return t(language, localSeat % 2 === 0 ? 'winnerTeamOpp' : 'winnerTeamYou');
  }
  if (view.winner === localSeat) {
    return t(language, 'winnerYou');
  }
  if (view.winner !== null) {
    return t(language, 'winnerBot', { name: seatName(language, view.winner) });
  }
  return t(language, 'matchOver');
}

function playerName(
  language: Language,
  seat: SeatId,
  localSeat: SeatId,
  names?: Array<string | undefined>,
): string {
  if (seat === localSeat) {
    return t(language, 'you');
  }
  return names?.[seat] || seatName(language, seat);
}

function PlayerRow({
  seat,
  view,
  language,
  localSeat,
  appearance,
  name,
}: {
  seat: SeatId;
  view: PublicMatchView;
  language: Language;
  localSeat: SeatId;
  appearance: SeatAppearance;
  name: string;
}) {
  const place = placeForSeat(seat, view.finishOrder);
  const handPts = view.lastHandPoints?.[seat] ?? 0;
  const total = view.scores[seat] ?? 0;
  const you = seat === localSeat;
  return (
    <View style={[styles.row, you && styles.rowYou]}>
      <View style={[styles.avatar, { borderColor: seatToken[seat] }]}>
        {appearance.profileUri ? (
          <Image source={{ uri: appearance.profileUri }} style={styles.photo} />
        ) : (
          <PlayerAvatar size={26} accent={seatToken[seat]} tone={appearance.tone} />
        )}
      </View>
      <Text style={[styles.player, you && styles.playerYou]} numberOfLines={1}>
        {name}
      </Text>
      <View style={[styles.placeChip, place === 1 && styles.placeFirst]}>
        <Text style={styles.placeText}>{place ? t(language, PLACE_KEYS[place - 1] ?? 'fourth') : '—'}</Text>
      </View>
      <Text style={styles.handPts}>+{handPts}</Text>
      <Text style={styles.total}>{total}</Text>
    </View>
  );
}

function TeamCard({
  label,
  score,
  color,
  seats,
  view,
  language,
  localSeat,
  appearances,
  names,
}: {
  label: string;
  score: number;
  color: string;
  seats: SeatId[];
  view: PublicMatchView;
  language: Language;
  localSeat: SeatId;
  appearances: SeatAppearance[];
  names?: Array<string | undefined>;
}) {
  return (
    <View style={[styles.teamCard, { borderColor: color }]}>
      <View style={styles.teamHead}>
        <Text style={[styles.teamName, { color }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.teamScore, { color }]}>{score}</Text>
      </View>
      <View style={styles.colHead}>
        <View style={styles.colAvatar} />
        <View style={styles.colPlayer} />
        <View style={styles.colPlace} />
        <Text style={[styles.colLabel, styles.colPts]}>{t(language, 'thisHand')}</Text>
        <Text style={[styles.colLabel, styles.colPts]}>{t(language, 'total')}</Text>
      </View>
      {seats.map((seat) => (
        <PlayerRow
          key={seat}
          seat={seat}
          view={view}
          language={language}
          localSeat={localSeat}
          appearance={appearances[seat]!}
          name={playerName(language, seat, localSeat, names)}
        />
      ))}
    </View>
  );
}

export function HandResultScreen({
  language,
  view,
  humanAppearance,
  localSeat = 0,
  names,
  onNextHand,
  onMenu,
  onPlayAgain,
  nextHandReady = false,
  waitingFor = null,
}: Props) {
  const appearances = ([0, 1, 2, 3] as SeatId[]).map((seat) => appearanceForSeat(seat, humanAppearance, localSeat));
  const matchOver = view.phase === 'matchComplete';
  const teams = view.teamScores;
  const yourTeam = localSeat % 2;
  const teamOrder = yourTeam === 0 ? ([0, 1] as const) : ([1, 0] as const);
  const action =
    view.phase === 'handComplete' ? (
      <UiButton
        label={nextHandReady ? t(language, 'youAreReady') : t(language, 'nextHand')}
        disabled={nextHandReady}
        onPress={onNextHand}
      />
    ) : (
      <UiButton label={t(language, 'playAgain')} onPress={onPlayAgain} />
    );

  return (
    <LandscapeFrame
      title={matchOver ? t(language, 'matchOver') : t(language, 'handOver')}
      backLabel={t(language, 'backToMenu')}
      onBack={onMenu}
      action={action}
    >
      <View style={styles.page}>
        <Text style={styles.meta} numberOfLines={1}>
          {matchOver ? winnerText(view, language, localSeat) : t(language, 'target', { score: view.targetScore })}
          {waitingFor ? `  ·  ${waitingFor}` : ''}
        </Text>
        {teams ? (
          <View style={styles.board}>
            {teamOrder.map((team) => (
              <TeamCard
                key={team}
                label={t(language, team === yourTeam ? 'teamYou' : 'teamOpp')}
                score={team === 0 ? teams.team0 : teams.team1}
                color={team === 0 ? colors.team1 : colors.team2}
                seats={TEAM_SEATS[team]!}
                view={view}
                language={language}
                localSeat={localSeat}
                appearances={appearances}
                names={names}
              />
            ))}
          </View>
        ) : (
          <View style={styles.soloWrap}>
            <View style={styles.soloCard}>
              <View style={styles.colHead}>
                <View style={styles.colAvatar} />
                <View style={styles.colPlayer} />
                <View style={styles.colPlace} />
                <Text style={[styles.colLabel, styles.colPts]}>{t(language, 'thisHand')}</Text>
                <Text style={[styles.colLabel, styles.colPts]}>{t(language, 'total')}</Text>
              </View>
              {([0, 1, 2, 3] as SeatId[])
                .slice()
                .sort((a, b) => (placeForSeat(a, view.finishOrder) ?? 9) - (placeForSeat(b, view.finishOrder) ?? 9))
                .map((seat) => (
                  <PlayerRow
                    key={seat}
                    seat={seat}
                    view={view}
                    language={language}
                    localSeat={localSeat}
                    appearance={appearances[seat]!}
                    name={playerName(language, seat, localSeat, names)}
                  />
                ))}
            </View>
          </View>
        )}
      </View>
    </LandscapeFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    gap: spacing.xs,
  },
  meta: {
    color: colors.goldHi,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
  board: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 0,
  },
  teamCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    maxWidth: 400,
    minWidth: 0,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderRadius: 16,
    backgroundColor: 'rgba(8, 16, 18, 0.72)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  teamHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 6,
    marginBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  teamName: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  teamScore: {
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    fontFamily: fonts.sans,
  },
  soloWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soloCard: {
    width: '100%',
    maxWidth: 520,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    backgroundColor: 'rgba(8, 16, 18, 0.72)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  colLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  colAvatar: {
    width: 30,
    flexShrink: 0,
  },
  colPlayer: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  colPlace: {
    width: 40,
    flexShrink: 0,
  },
  colPts: {
    width: 52,
    flexShrink: 0,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  rowYou: {
    backgroundColor: 'rgba(232, 197, 71, 0.12)',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 2,
    flexShrink: 0,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  player: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  playerYou: {
    color: colors.goldHi,
  },
  placeChip: {
    width: 40,
    flexShrink: 0,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  placeFirst: {
    backgroundColor: 'rgba(232, 197, 71, 0.28)',
  },
  placeText: {
    color: colors.goldHi,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  handPts: {
    width: 52,
    flexShrink: 0,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    fontFamily: fonts.sans,
  },
  total: {
    width: 52,
    flexShrink: 0,
    color: colors.cream,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    fontFamily: fonts.sans,
  },
});
