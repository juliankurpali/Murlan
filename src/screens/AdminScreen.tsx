import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Language } from '../application/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LandscapeFrame, LandscapePane } from '../components/LandscapeFrame';
import { UiButton } from '../components/UiButton';
import { CombinationType } from '../domain';
import { t, tError } from '../i18n';
import { AdminGameView, AdminPlayerView, AdminSeatView, AdminSnapshot } from '../platform/types';
import { endAdminGame, fetchAdminSnapshot } from '../social/api';
import { colors, radius, spacing } from '../theme';

const ADMIN_TOKEN_KEY = 'murlan.adminToken';
const EMPTY_SNAPSHOT: AdminSnapshot = {
  at: 0,
  accounts: 0,
  online: 0,
  lobbies: 0,
  playing: 0,
  waitingJoins: 0,
  games: [],
  players: [],
};

type Filter = 'all' | 'lobby' | 'playing';

type Props = {
  language: Language;
  onBack: () => void;
};

function storedToken(): string {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') {
    return '';
  }
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? '';
}

function rememberToken(value: string) {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') {
    return;
  }
  if (value) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, value);
  } else {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

function relativeTime(language: Language, updatedAt: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - updatedAt) / 60_000));
  if (minutes < 1) {
    return t(language, 'justNow');
  }
  return t(language, 'minutesAgo', { count: minutes });
}

function unlockError(language: Language, error: unknown): string {
  const code = error instanceof Error ? error.message : String(error ?? '');
  if (code === 'not-found') {
    return t(language, 'adminDisabled');
  }
  if (code === 'auth') {
    return t(language, 'adminBadPassword');
  }
  return tError(language, error);
}

function trickLabel(language: Language, trick: CombinationType | null): string | null {
  if (!trick) {
    return null;
  }
  const key =
    trick === 'single'
      ? 'comboSingle'
      : trick === 'pair'
        ? 'comboPair'
        : trick === 'triple'
          ? 'comboTriple'
          : trick === 'straight'
            ? 'comboStraight'
            : trick === 'bomb'
              ? 'comboBomb'
              : 'comboFlush';
  return t(language, 'adminOnTable', { play: t(language, key) });
}

function connectionLabel(language: Language, seat: AdminSeatView): string {
  if (seat.empty) {
    return t(language, 'emptySeat');
  }
  if (seat.isBot) {
    return t(language, 'botSeat');
  }
  if (seat.connection === 'reconnecting' || seat.connection === 'restoring') {
    return t(language, 'playerReconnecting');
  }
  if (seat.connection === 'disconnected' || seat.connection === 'failed' || seat.connection === 'abandoned') {
    return t(language, 'disconnected');
  }
  return t(language, 'connected');
}

async function copyText(value: string) {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  await nav?.clipboard?.writeText(value);
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SeatCell({ language, seat, turn }: { language: Language; seat: AdminSeatView; turn: boolean }) {
  return (
    <View style={[styles.seat, turn && styles.seatTurn, seat.empty && styles.seatEmpty]}>
      <Text style={styles.seatName} numberOfLines={1}>
        {seat.empty ? t(language, 'emptySeat') : seat.name}
        {seat.isHost ? ` · ${t(language, 'host')}` : ''}
      </Text>
      <Text style={styles.seatMeta} numberOfLines={1}>
        {connectionLabel(language, seat)}
        {!seat.empty && !seat.isBot && seat.speaking ? ` · ${t(language, 'voiceLive')}` : ''}
        {!seat.empty && !seat.isBot && seat.muted ? ` · ${t(language, 'voiceOff')}` : ''}
      </Text>
      {seat.cards != null || seat.score != null ? (
        <Text style={styles.seatMeta} numberOfLines={1}>
          {seat.cards != null ? t(language, 'adminCards', { count: seat.cards }) : ''}
          {seat.score != null ? ` · ${seat.score}` : ''}
        </Text>
      ) : !seat.empty && !seat.isBot ? (
        <Text style={styles.seatMeta}>{seat.lobbyReady ? t(language, 'ready') : t(language, 'waiting')}</Text>
      ) : null}
    </View>
  );
}

function GameCard({
  language,
  game,
  copied,
  onCopy,
  onEnd,
}: {
  language: Language;
  game: AdminGameView;
  copied: boolean;
  onCopy: () => void;
  onEnd: () => void;
}) {
  const filled = game.seats.filter((seat) => !seat.empty).length;
  const onTable = trickLabel(language, game.trick);
  const bits = [
    t(language, 'mode2v2'),
    t(language, 'adminSeats', { filled }),
    game.handIndex ? t(language, 'adminHand', { n: game.handIndex }) : null,
    game.currentName ? t(language, 'adminTurn', { name: game.currentName }) : null,
    onTable,
  ].filter(Boolean);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{game.code}</Text>
        <View style={[styles.badge, game.status === 'playing' ? styles.badgePlay : styles.badgeLobby]}>
          <Text style={styles.badgeText}>
            {game.status === 'playing' ? t(language, 'adminPlaying') : t(language, 'adminLobby')}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onCopy} style={styles.copyBtn}>
          <Text style={styles.copyText}>{copied ? t(language, 'adminCopied') : t(language, 'adminCopy')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onEnd} style={styles.copyBtn}>
          <Text style={styles.endText}>{t(language, 'adminEnd')}</Text>
        </Pressable>
      </View>
      <Text style={styles.meta}>{bits.join(' · ')}</Text>
      {game.teamScores && game.targetScore != null ? (
        <Text style={styles.names}>
          {t(language, 'adminScoreLine', {
            left: `${t(language, 'team1')} ${game.teamScores.team0}`,
            right: `${t(language, 'team2')} ${game.teamScores.team1}`,
          })}
          {` · ${t(language, 'adminTarget', { score: game.targetScore })}`}
        </Text>
      ) : null}
      <View style={styles.seats}>
        {game.seats.map((seat, index) => (
          <SeatCell
            key={`${game.id}-${index}`}
            language={language}
            seat={seat}
            turn={Boolean(game.currentName && seat.name === game.currentName && !seat.empty)}
          />
        ))}
      </View>
      {game.pendingJoins.length > 0 ? (
        <Text style={styles.meta}>{`${t(language, 'joinRequests')}: ${game.pendingJoins.join(', ')}`}</Text>
      ) : null}
      <Text style={styles.when}>
        {t(language, 'adminUpdated', { when: relativeTime(language, game.updatedAt) })}
        {' · '}
        {t(language, 'adminHumans', { count: game.connectedHumans })}
        {' · '}
        {t(language, 'adminBots', { count: game.bots })}
        {game.chatLines > 0 ? ` · ${t(language, 'adminChatCount', { count: game.chatLines })}` : ''}
      </Text>
    </View>
  );
}

function PlayerRow({ language, player }: { language: Language; player: AdminPlayerView }) {
  return (
    <View style={styles.player}>
      <View style={[styles.dot, player.online ? styles.dotOn : styles.dotOff]} />
      <View style={styles.playerBody}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.username}
        </Text>
        <Text style={styles.seatMeta} numberOfLines={1}>
          {player.tableCode
            ? `${player.tableCode} · ${player.tableStatus === 'playing' ? t(language, 'adminPlaying') : t(language, 'adminLobby')}`
            : player.online
              ? t(language, 'onlineNow')
              : relativeTime(language, player.lastSeen)}
        </Text>
      </View>
    </View>
  );
}

export function AdminScreen({ language, onBack }: Props) {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(storedToken);
  const [snapshot, setSnapshot] = useState<AdminSnapshot>(EMPTY_SNAPSHOT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [ending, setEnding] = useState<AdminGameView | null>(null);

  const load = useCallback(
    async (secret: string) => {
      if (!secret) {
        return false;
      }
      setBusy(true);
      try {
        const next = await fetchAdminSnapshot(secret);
        setSnapshot(next);
        setError(null);
        rememberToken(secret);
        setToken(secret);
        return true;
      } catch (caught) {
        setError(unlockError(language, caught));
        rememberToken('');
        setToken('');
        setSnapshot(EMPTY_SNAPSHOT);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [language],
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    const first = setTimeout(() => {
      void load(token);
    }, 0);
    const timer = setInterval(() => {
      void load(token);
    }, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load, token]);

  const games = useMemo(() => {
    const needle = query.trim().toUpperCase();
    return snapshot.games.filter((game) => {
      if (filter !== 'all' && game.status !== filter) {
        return false;
      }
      return !needle || game.code.includes(needle) || game.hostName.toUpperCase().includes(needle);
    });
  }, [filter, query, snapshot.games]);

  const unlock = () => {
    const secret = password.trim();
    if (!secret) {
      return;
    }
    void load(secret);
  };

  const lock = () => {
    rememberToken('');
    setToken('');
    setPassword('');
    setSnapshot(EMPTY_SNAPSHOT);
    setError(null);
  };

  return (
    <View style={styles.root}>
    <LandscapeFrame
      title={t(language, 'adminTitle')}
      backLabel={t(language, 'back')}
      onBack={onBack}
      action={
        token ? (
          <View style={styles.actions}>
            <UiButton label={t(language, 'adminRefresh')} variant="ghost" onPress={() => void load(token)} />
            <UiButton label={t(language, 'adminLogout')} variant="ghost" onPress={lock} />
          </View>
        ) : null
      }
    >
      {token ? (
        <>
          <LandscapePane wide>
            <View style={styles.stats}>
              <Stat label={t(language, 'adminOnline')} value={snapshot.online} />
              <Stat label={t(language, 'adminLobbies')} value={snapshot.lobbies} />
              <Stat label={t(language, 'adminPlaying')} value={snapshot.playing} />
              <Stat label={t(language, 'adminWaiting')} value={snapshot.waitingJoins} />
              <Stat label={t(language, 'adminAccounts')} value={snapshot.accounts} />
            </View>
            <View style={styles.toolbar}>
              {(['all', 'lobby', 'playing'] as const).map((row) => (
                <Pressable
                  key={row}
                  onPress={() => setFilter(row)}
                  style={[styles.chip, filter === row && styles.chipOn]}
                >
                  <Text style={[styles.chipText, filter === row && styles.chipTextOn]}>
                    {row === 'all'
                      ? t(language, 'adminAll')
                      : row === 'lobby'
                        ? t(language, 'adminLobby')
                        : t(language, 'adminPlaying')}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                value={query}
                onChangeText={setQuery}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={t(language, 'adminSearchCode')}
                placeholderTextColor={colors.muted}
                style={styles.search}
              />
            </View>
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {games.length === 0 && !error ? <Text style={styles.meta}>{t(language, 'adminEmpty')}</Text> : null}
              {games.map((game) => (
                <GameCard
                  key={game.id}
                  language={language}
                  game={game}
                  copied={copied === game.code}
                  onCopy={() => {
                    void copyText(game.code).then(() => {
                      setCopied(game.code);
                      setTimeout(() => setCopied((code) => (code === game.code ? null : code)), 1500);
                    });
                  }}
                  onEnd={() => setEnding(game)}
                />
              ))}
            </ScrollView>
          </LandscapePane>
          <LandscapePane>
            <Text style={styles.label}>{t(language, 'adminRecent')}</Text>
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {snapshot.players.length === 0 ? <Text style={styles.meta}>{t(language, 'adminNoPlayers')}</Text> : null}
              {snapshot.players.map((player) => (
                <PlayerRow key={player.username} language={language} player={player} />
              ))}
            </ScrollView>
          </LandscapePane>
        </>
      ) : (
        <LandscapePane wide>
          <View style={styles.unlock}>
            <Text style={styles.label}>{t(language, 'adminPassword')}</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={unlock}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              secureTextEntry
              placeholder={t(language, 'adminPassword')}
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <UiButton label={t(language, 'adminUnlock')} onPress={unlock} disabled={busy || password.trim().length < 16} />
          </View>
        </LandscapePane>
      )}
    </LandscapeFrame>
      <ConfirmDialog
        visible={Boolean(ending)}
        title={t(language, 'adminEndTitle')}
        body={t(language, 'adminEndBody', { code: ending?.code ?? '' })}
        confirmLabel={t(language, 'adminEnd')}
        cancelLabel={t(language, 'cancel')}
        onCancel={() => setEnding(null)}
        onConfirm={() => {
          const game = ending;
          const secret = token;
          setEnding(null);
          if (!game || !secret) {
            return;
          }
          void endAdminGame(secret, game.id)
            .then(setSnapshot)
            .catch((caught: unknown) => {
              setError(unlockError(language, caught));
            });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: {
    color: colors.goldHi,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.feltLight,
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipText: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chipTextOn: {
    color: colors.ink,
  },
  search: {
    flex: 1,
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.feltLight,
    color: colors.cream,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  unlock: {
    maxWidth: 420,
    gap: spacing.sm,
    justifyContent: 'center',
    flex: 1,
  },
  label: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLight,
    color: colors.cream,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.goldHi,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgePlay: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
  },
  badgeLobby: {
    backgroundColor: 'rgba(232, 197, 71, 0.18)',
  },
  badgeText: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  copyBtn: {
    marginLeft: 'auto',
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  copyText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  endText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  names: {
    color: colors.cream,
    fontSize: 14,
  },
  when: {
    color: colors.sage,
    fontSize: 12,
  },
  seats: {
    flexDirection: 'row',
    gap: 6,
  },
  seat: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    gap: 2,
  },
  seatTurn: {
    borderColor: colors.gold,
  },
  seatEmpty: {
    opacity: 0.55,
  },
  seatName: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: '700',
  },
  seatMeta: {
    color: colors.muted,
    fontSize: 11,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
  },
  playerBody: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    color: colors.cream,
    fontSize: 14,
    fontWeight: '700',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOn: {
    backgroundColor: colors.good,
  },
  dotOff: {
    backgroundColor: colors.muted,
  },
});
