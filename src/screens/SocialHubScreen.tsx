import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Language } from '../application/types';
import { LandscapeFrame } from '../components/LandscapeFrame';
import { UiButton } from '../components/UiButton';
import { MatchMode } from '../domain';
import { Friendship, GameSummary, PlatformNotice, PublicPlayer } from '../platform/types';
import { isRoomCode } from '../online/room';
import { NetStatus } from '../online/net';
import { t } from '../i18n';
import { colors, fonts, radius, spacing } from '../theme';

type Props = {
  language: Language;
  status: NetStatus;
  error: string | null;
  me: PublicPlayer | null;
  friends: PublicPlayer[];
  requests: Friendship[];
  inbox: PlatformNotice[];
  games: GameSummary[];
  waitingJoin?: string | null;
  onBack: () => void;
  onProfile: () => void;
  onCreate: (mode: MatchMode) => void;
  onJoin: (code: string) => void;
  onOpenGame: (game: GameSummary) => void;
  onRespond: (id: string, accept: boolean) => void;
  onJoinFriend: (gameId: string) => void;
  onFriendMidGame: (name: string) => void;
};

function statusLine(language: Language, status: NetStatus, error: string | null): string | null {
  if (error) {
    return t(language, error === 'room-missing' ? 'roomMissing' : error === 'room-full' ? 'roomFull' : 'relayDown');
  }
  if (status === 'connecting') {
    return t(language, 'connecting');
  }
  if (status === 'reconnecting') {
    return t(language, 'reconnecting');
  }
  if (status === 'down' || status === 'failed') {
    return t(language, 'relayDown');
  }
  return null;
}

function PeopleGlyph() {
  return (
    <View style={styles.people}>
      <View style={[styles.person, styles.personBack]}>
        <View style={styles.head} />
        <View style={styles.torso} />
      </View>
      <View style={styles.person}>
        <View style={styles.head} />
        <View style={styles.torso} />
      </View>
    </View>
  );
}

export function SocialHubScreen({
  language,
  status,
  error,
  me,
  friends,
  requests,
  inbox,
  games,
  waitingJoin,
  onBack,
  onProfile,
  onCreate,
  onJoin,
  onOpenGame,
  onRespond,
  onJoinFriend,
  onFriendMidGame,
}: Props) {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<MatchMode>('2v2');
  const [friendsOpen, setFriendsOpen] = useState(false);
  const notice = statusLine(language, status, error);
  const unread = inbox.filter((item) => !item.read).slice(0, 3);
  const friendsBadge = requests.length > 0 || unread.length > 0;

  const join = () => {
    const next = code.trim().toUpperCase();
    if (!isRoomCode(next)) {
      Alert.alert(t(language, 'joinRoom'), t(language, 'roomCodeHint'));
      return;
    }
    onJoin(next);
  };

  return (
    <View style={styles.root}>
    <LandscapeFrame
      title={t(language, 'social')}
      backLabel={t(language, 'back')}
      onBack={onBack}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'friends')}
          onPress={() => setFriendsOpen(true)}
          style={styles.friendsBtn}
        >
          <PeopleGlyph />
          {friendsBadge ? <View style={styles.friendsDot} /> : null}
        </Pressable>
      }
    >
      <View style={styles.page}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {waitingJoin ? (
          <Text style={styles.notice}>{t(language, 'waitingToJoin')}</Text>
        ) : null}
        <View style={styles.cols}>
          <View style={styles.col}>
            <Pressable onPress={onProfile} style={styles.me}>
              <Text style={styles.username} numberOfLines={1}>
                {me?.username ?? t(language, 'guestAccount')}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {t(language, 'playingAs', { name: me?.username ?? t(language, 'guestAccount') })}
              </Text>
            </Pressable>
            <Text style={styles.label}>{t(language, 'mode')}</Text>
            <View style={styles.row}>
              <Pressable onPress={() => setMode('2v2')} style={[styles.choice, mode === '2v2' && styles.choiceOn]}>
                <Text style={[styles.choiceLabel, mode === '2v2' && styles.choiceLabelOn]}>{t(language, 'mode2v2')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode('individual')}
                style={[styles.choice, mode === 'individual' && styles.choiceOn]}
              >
                <Text style={[styles.choiceLabel, mode === 'individual' && styles.choiceLabelOn]}>
                  {t(language, 'modeIndividual')}
                </Text>
              </Pressable>
            </View>
            <UiButton label={t(language, 'createRoom')} onPress={() => onCreate(mode)} />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>{t(language, 'joinRoom')}</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
              placeholder="A7K2"
              placeholderTextColor={colors.muted}
              value={code}
              onChangeText={setCode}
              onSubmitEditing={join}
              style={styles.input}
            />
            <UiButton label={t(language, 'joinRoom')} variant="secondary" onPress={join} />
            <Text style={styles.label}>{t(language, 'activeGames')}</Text>
            <ScrollView style={styles.games} contentContainerStyle={styles.gamesInner} showsVerticalScrollIndicator={false}>
              {games.length === 0 ? <Text style={styles.meta}>{t(language, 'noActiveGames')}</Text> : null}
              {games.map((game) => (
                <Pressable key={game.id} onPress={() => onOpenGame(game)} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {game.code} · {game.mode === '2v2' ? t(language, 'mode2v2') : t(language, 'modeIndividual')}
                  </Text>
                  <Text style={styles.meta}>
                    {game.joinPending
                      ? t(language, 'waitingToJoin')
                      : game.status === 'playing'
                        ? t(language, 'resumeTable')
                        : t(language, 'seatsOpen')}
                    {game.invited ? ` · ${t(language, 'invitedYou')}` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </LandscapeFrame>
      {friendsOpen ? (
        <Pressable style={styles.overlay} onPress={() => setFriendsOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t(language, 'friends')}</Text>
              <UiButton label={t(language, 'close')} variant="ghost" onPress={() => setFriendsOpen(false)} />
            </View>
            <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
              {requests.map((row) => (
                <View key={row.id} style={styles.friend}>
                  <Text style={styles.friendName}>{row.fromUsername ?? t(language, 'friendRequests')}</Text>
                  <UiButton label={t(language, 'accept')} variant="ghost" onPress={() => onRespond(row.id, true)} />
                  <UiButton label={t(language, 'reject')} variant="ghost" onPress={() => onRespond(row.id, false)} />
                </View>
              ))}
              {friends.length === 0 && requests.length === 0 ? (
                <Text style={styles.meta}>{t(language, 'noFriends')}</Text>
              ) : null}
              {friends.map((player) => (
                <View key={player.id} style={styles.friend}>
                  <View style={styles.friendCopy}>
                    <Text style={styles.friendName}>{player.username}</Text>
                    <Text style={styles.meta}>
                      {player.playing
                        ? t(language, 'playingNow')
                        : player.online
                          ? t(language, 'onlineNow')
                          : t(language, 'offline')}
                    </Text>
                  </View>
                  {player.playingGameId && !player.playing ? (
                    <UiButton
                      label={t(language, 'joinFriend')}
                      variant="ghost"
                      onPress={() => {
                        setFriendsOpen(false);
                        onJoinFriend(player.playingGameId!);
                      }}
                    />
                  ) : player.playing ? (
                    <UiButton
                      label={t(language, 'joinFriend')}
                      variant="ghost"
                      onPress={() => {
                        setFriendsOpen(false);
                        onFriendMidGame(player.username);
                      }}
                    />
                  ) : null}
                </View>
              ))}
              {unread.map((item) => (
                <Text key={item.id} style={styles.meta}>
                  {item.body}
                </Text>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  page: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    gap: spacing.sm,
  },
  notice: {
    color: colors.gold,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  cols: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 0,
  },
  col: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  me: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  username: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  label: {
    color: colors.cream,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.sans,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  choiceLabel: {
    color: colors.cream,
    fontWeight: '700',
  },
  choiceLabelOn: {
    color: colors.ink,
  },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLight,
    color: colors.cream,
    paddingHorizontal: 14,
    letterSpacing: 6,
    fontSize: 18,
    fontWeight: '800',
  },
  games: {
    flex: 1,
    minHeight: 0,
  },
  gamesInner: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    padding: 10,
    gap: 2,
  },
  cardTitle: {
    color: colors.cream,
    fontWeight: '700',
  },
  friendsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  people: {
    width: 22,
    height: 16,
  },
  person: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  personBack: {
    right: 8,
    opacity: 0.45,
  },
  head: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.goldHi,
  },
  torso: {
    marginTop: 1,
    width: 11,
    height: 8,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: colors.goldHi,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    zIndex: 20,
  },
  sheet: {
    width: '78%',
    maxWidth: 520,
    maxHeight: '88%',
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.28)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sheetTitle: {
    color: colors.goldHi,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  sheetBody: {
    minHeight: 120,
    maxHeight: 240,
  },
  sheetList: {
    gap: 4,
    paddingBottom: spacing.sm,
  },
  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 6,
  },
  friendCopy: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    color: colors.cream,
    fontWeight: '700',
  },
});
