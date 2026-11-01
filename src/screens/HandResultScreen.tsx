import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SeatAppearance, appearanceForSeat } from '../application/players';
import { Language } from '../application/types';
import { ChaosBook } from '../components/ChaosBook';
import { SuperBook } from '../components/SuperBook';
import { LandscapeFrame } from '../components/LandscapeFrame';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { WinnerCrown, WinFireworks } from '../components/WinFireworks';
import { UiButton } from '../components/UiButton';
import { VoiceMic, voiceMicLabel } from '../components/VoiceMic';
import { ChaosAbilityId, placeForSeat, PublicMatchView, SeatId } from '../domain';
import { TableSeries } from '../platform/types';
import { RoomSeat } from '../online/room';
import { seatName, t } from '../i18n';
import { colors, fonts, spacing, teamToken } from '../theme';

const PLACE_KEYS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;

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
  roomSeats?: RoomSeat[] | null;
  onToggleMute?: () => void;
  specialVictorySeat?: SeatId | null;
  chaosActive?: boolean;
  chaosAbilityId?: ChaosAbilityId | null;
  playAgainReady?: boolean;
  series?: TableSeries | null;
};

function winnerText(view: PublicMatchView, language: Language, localSeat: SeatId): string {
  if (view.winner === 'team0') {
    return t(language, 'winnerTeam1');
  }
  if (view.winner === 'team1') {
    return t(language, 'winnerTeam2');
  }
  if (view.winner === 'team2') {
    return t(language, 'winnerTeam3');
  }
  if (view.winner === localSeat) {
    return t(language, 'winnerYou');
  }
  if (typeof view.winner === 'number') {
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
  occupant,
  onToggleMute,
  gamesWon,
}: {
  seat: SeatId;
  view: PublicMatchView;
  language: Language;
  localSeat: SeatId;
  appearance: SeatAppearance;
  name: string;
  occupant?: RoomSeat | null;
  onToggleMute?: () => void;
  gamesWon?: number;
}) {
  const place = placeForSeat(seat, view.finishOrder, view.cardCounts.length);
  const handPts = view.lastHandPoints?.[seat] ?? 0;
  const total = view.scores[seat] ?? 0;
  const you = seat === localSeat;
  const accent = teamToken(view.teamOf[seat] ?? seat % (view.mode === 'super' ? 3 : 2));
  const voice = occupant
    ? {
        muted: occupant.muted,
        speaking: occupant.speaking,
        available: occupant.voiceAvailable !== false,
        canControl: Boolean(onToggleMute && occupant.isYou && !occupant.isBot),
        onToggle: onToggleMute,
      }
    : null;
  return (
    <View style={[styles.row, you && styles.rowYou]}>
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { borderColor: accent }]}>
          {appearance.profileUri ? (
            <Image source={{ uri: appearance.profileUri }} style={styles.photo} />
          ) : (
            <PlayerAvatar size={26} accent={accent} tone={appearance.tone} />
          )}
        </View>
        {place === 1 ? <WinnerCrown /> : null}
        {place === 1 ? (
          <WinFireworks burstKey={`result-${view.handIndex}-${seat}`} accent={accent} />
        ) : null}
      </View>
      <Text style={[styles.player, you && styles.playerYou]} numberOfLines={1}>
        {name}
      </Text>
      {voice ? (
        <VoiceMic
          muted={voice.muted}
          speaking={voice.speaking}
          available={voice.available}
          canControl={voice.canControl}
          onToggle={voice.onToggle}
          accessibilityLabel={voiceMicLabel(language, voice)}
        />
      ) : null}
      <View style={[styles.placeChip, place === 1 && styles.placeFirst]}>
        <Text style={styles.placeText}>{place ? t(language, PLACE_KEYS[place - 1] ?? 'fourth') : '—'}</Text>
      </View>
      <Text style={styles.handPts}>+{handPts}</Text>
      <Text style={styles.total}>{total}</Text>
      {gamesWon !== undefined ? <Text style={styles.total}>{gamesWon}</Text> : null}
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
  roomSeats,
  onToggleMute,
  seriesWins,
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
  roomSeats?: RoomSeat[] | null;
  onToggleMute?: () => void;
  seriesWins?: number[];
}) {
  const roundPts = seats.reduce((sum, seat) => sum + (view.lastHandPoints?.[seat] ?? 0), 0 as number);
  return (
    <View style={[styles.teamCard, { borderColor: color }]}>
      <View style={styles.teamHead}>
        <Text style={[styles.teamName, { color }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.teamScore, { color }]}>
          {view.lastHandPoints ? `+${roundPts} · ${score}` : score}
        </Text>
      </View>
      <View style={styles.colHead}>
        <View style={styles.colAvatar} />
        <View style={styles.colPlayer} />
        <View style={styles.colPlace} />
        <Text style={[styles.colLabel, styles.colPts]}>{t(language, 'thisHand')}</Text>
        <Text style={[styles.colLabel, styles.colPts]}>{t(language, 'total')}</Text>
        {seriesWins ? <Text style={[styles.colLabel, styles.colPts]}>{t(language, 'seriesWins')}</Text> : null}
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
          occupant={roomSeats?.[seat]}
          onToggleMute={onToggleMute}
          gamesWon={seriesWins?.[seat]}
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
  roomSeats = null,
  onToggleMute,
  specialVictorySeat = null,
  chaosActive = false,
  chaosAbilityId = null,
  playAgainReady = false,
  series = null,
}: Props) {
  const [bookOpen, setBookOpen] = useState(false);
  const seatCount = view.cardCounts.length;
  const appearances = Array.from({ length: seatCount }, (_, seat) =>
    appearanceForSeat(seat as SeatId, humanAppearance, localSeat),
  );
  const matchOver = view.phase === 'matchComplete';
  const teams = view.teamScores;
  const yourTeam = view.teamOf[localSeat] ?? localSeat % (view.mode === 'super' ? 3 : 2);
  const teamOrder = teams.team2 === undefined ? ([0, 1] as const) : ([0, 1, 2] as const);
  const teamScore = (team: number) => (team === 0 ? teams.team0 : team === 1 ? teams.team1 : (teams.team2 ?? 0));
  const teamColor = (team: number) => (team === 0 ? colors.team1 : team === 1 ? colors.team2 : colors.team3);
  const teamKey = (team: number) => (team === 0 ? 'team1' : team === 1 ? 'team2' : 'team3');
  const seatsForTeam = (team: number) =>
    view.teamOf.flatMap((mapped, seat) => (mapped === team ? [seat as SeatId] : []));
  const action =
    view.phase === 'handComplete' ? (
      <UiButton
        label={nextHandReady ? t(language, 'youAreReady') : t(language, 'nextHand')}
        disabled={nextHandReady}
        onPress={onNextHand}
      />
    ) : (
      <UiButton
        label={playAgainReady ? t(language, 'youAreReady') : t(language, 'playAgain')}
        disabled={playAgainReady}
        onPress={onPlayAgain}
      />
    );

  return (
    <>
    <LandscapeFrame
      title={matchOver ? t(language, 'matchOver') : t(language, 'handOver')}
      backLabel={t(language, 'backToMenu')}
      onBack={onMenu}
      action={action}
    >
      <View style={styles.page}>
        <Text style={styles.meta} numberOfLines={2}>
          {matchOver && specialVictorySeat !== null
            ? t(language, 'chaosLastManWin')
            : matchOver
              ? winnerText(view, language, localSeat)
              : t(language, 'target', { score: view.targetScore })}
          {waitingFor ? `  ·  ${waitingFor}` : ''}
        </Text>
        {matchOver && specialVictorySeat !== null ? (
          <Text style={styles.meta} numberOfLines={1}>
            {winnerText(view, language, localSeat)}
          </Text>
        ) : null}
        {matchOver ? (
          <Text style={styles.meta} numberOfLines={1}>
            {t(language, 'seriesScore', {
              left: series?.teamWins[0] ?? 0,
              right: series?.teamWins[1] ?? 0,
            })}
            {teams.team2 !== undefined ? `–${series?.teamWins[2] ?? 0}` : ''}
            {'  ·  '}
            {t(language, 'seriesMatch')} {teams.team0}–{teams.team1}
            {teams.team2 !== undefined ? `–${teams.team2}` : ''}
          </Text>
        ) : teams.team2 !== undefined ? (
          <Text style={styles.meta} numberOfLines={1}>
            {teams.team0}–{teams.team1}–{teams.team2}  ·  {t(language, 'target', { score: view.targetScore })}
          </Text>
        ) : null}
        {chaosActive || view.mode === 'super' ? (
          <UiButton
            label={t(language, chaosActive ? 'chaosBookTitle' : 'superBookTitle')}
            variant="ghost"
            onPress={() => setBookOpen(true)}
            style={styles.bookBtn}
          />
        ) : null}
        <View style={styles.board}>
          {teamOrder.map((team) => (
            <TeamCard
              key={team}
              label={
                team === yourTeam
                  ? `${t(language, teamKey(team))} · ${t(language, 'you')}`
                  : t(language, teamKey(team))
              }
              score={teamScore(team)}
              color={teamColor(team)}
              seats={seatsForTeam(team)}
              view={view}
              language={language}
              localSeat={localSeat}
              appearances={appearances}
              names={names}
              roomSeats={roomSeats}
              onToggleMute={onToggleMute}
              seriesWins={matchOver ? series?.seatWins : undefined}
            />
          ))}
        </View>
      </View>
    </LandscapeFrame>
    <ChaosBook
      language={language}
      visible={bookOpen && chaosActive}
      ownAbilityId={chaosAbilityId}
      onClose={() => setBookOpen(false)}
    />
    <SuperBook
      language={language}
      visible={bookOpen && view.mode === 'super' && !chaosActive}
      onClose={() => setBookOpen(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    gap: spacing.xs,
  },
  bookBtn: {
    alignSelf: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
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
    alignItems: 'stretch',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 0,
  },
  teamCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    maxWidth: 400,
    minWidth: 150,
    overflow: 'visible',
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
  avatarWrap: {
    width: 30,
    height: 30,
    flexShrink: 0,
    overflow: 'visible',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 2,
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
