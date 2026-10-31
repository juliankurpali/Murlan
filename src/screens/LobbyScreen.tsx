import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { ChatMessage } from '../online/chat';
import { GameRoom, guestsAreReady, isRoomCode, localSeatOf, RoomSeat, roomIsReady, waitingReadyNames } from '../online/room';
import { NetStatus } from '../online/net';
import { PublicPlayer } from '../platform/types';
import { ChatPanel } from '../components/ChatPanel';
import { KeyboardField } from '../components/KeyboardField';
import { LandscapeFrame, LandscapePane } from '../components/LandscapeFrame';
import { UiButton } from '../components/UiButton';
import { VoiceMic, voiceMicLabel } from '../components/VoiceMic';
import { t, tError } from '../i18n';
import { colors, fonts, radius, spacing } from '../theme';

type Props = {
  language: Language;
  room: GameRoom | null;
  status: NetStatus;
  error: string | null;
  onBack: () => void;
  onHost: () => void;
  onJoin: (code: string) => void;
  onFillBots: () => void;
  onStart: () => void;
  onLeave: () => void;
  chat: ChatMessage[];
  onSendChat: (text: string) => void;
  friends?: PublicPlayer[];
  onInvite?: (username: string, team?: 0 | 1) => void;
  onClaimSeat?: (seat: number) => void;
  onAddFriend?: (username: string) => void;
  onShare?: () => void;
  onRespondJoin?: (fromId: string, accept: boolean) => void;
  onReady?: (ready: boolean) => void;
  onToggleMute?: () => void;
};

function statusText(language: Language, status: NetStatus, error: string | null): string {
  if (error) {
    return tError(language, error);
  }
  if (status === 'connecting') {
    return t(language, 'connecting');
  }
  if (status === 'reconnecting') {
    return t(language, 'reconnecting');
  }
  if (status === 'restoring') {
    return t(language, 'restoringSession');
  }
  if (status === 'failed') {
    return t(language, 'connectionFailed');
  }
  if (status === 'live') {
    return t(language, 'connected');
  }
  if (status === 'down') {
    return t(language, 'relayDown');
  }
  return t(language, 'onlineHint');
}

export function LobbyScreen({
  language,
  room,
  status,
  error,
  onBack,
  onHost,
  onJoin,
  onFillBots,
  onStart,
  onLeave,
  chat,
  onSendChat,
  friends = [],
  onInvite,
  onClaimSeat,
  onAddFriend,
  onShare,
  onRespondJoin,
  onReady,
  onToggleMute,
}: Props) {
  const [code, setCode] = useState('');

  const join = () => {
    const next = code.trim().toUpperCase();
    if (!isRoomCode(next)) {
      Alert.alert(t(language, 'joinRoom'), t(language, 'roomCodeHint'));
      return;
    }
    onJoin(next);
  };

  if (!room) {
    return (
      <LandscapeFrame title={t(language, 'playOnline')} backLabel={t(language, 'back')} onBack={onBack}>
        <LandscapePane>
          <View style={styles.intro}>
            <Text style={styles.body}>{statusText(language, status, error)}</Text>
            <UiButton label={t(language, 'createRoom')} onPress={onHost} />
          </View>
        </LandscapePane>
        <LandscapePane>
          <View style={styles.join}>
            <Text style={styles.label}>{t(language, 'joinRoom')}</Text>
            <KeyboardField
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
              placeholder="A7K2"
              placeholderTextColor={colors.muted}
              value={code}
              onChangeText={setCode}
              onSubmitEditing={join}
              label={t(language, 'joinRoom')}
              doneLabel={t(language, 'ok')}
              style={styles.input}
            />
            <UiButton label={t(language, 'joinRoom')} variant="secondary" onPress={join} />
          </View>
        </LandscapePane>
      </LandscapeFrame>
    );
  }

  const you = room.seats.find((seat) => seat.isYou);
  const waiting = waitingReadyNames(room);
  const canStart = roomIsReady(room) && guestsAreReady(room);

  if (!room.host) {
    return (
      <LandscapeFrame title={t(language, 'room')} backLabel={t(language, 'back')} onBack={onLeave}>
        <LandscapePane>
          <ScrollView contentContainerStyle={styles.roomMeta} keyboardShouldPersistTaps="handled">
            <Text style={styles.code}>{room.code}</Text>
            <UiButton
              label={you?.lobbyReady ? t(language, 'notReady') : t(language, 'ready')}
              variant={you?.lobbyReady ? 'secondary' : 'primary'}
              onPress={() => onReady?.(!Boolean(you?.lobbyReady))}
            />
            {onToggleMute && you?.ready && !you.isBot ? (
              <UiButton
                label={you.muted ? t(language, 'voiceOff') : t(language, 'voiceOn')}
                variant={you.muted ? 'secondary' : 'go'}
                onPress={onToggleMute}
              />
            ) : null}
            {you?.lobbyReady ? <Text style={styles.body}>{t(language, 'waitingHost')}</Text> : null}
          </ScrollView>
        </LandscapePane>
        <LandscapePane>
          <View style={styles.right}>
            <RoomSeats
              language={language}
              room={room}
              friends={friends}
              onClaimSeat={onClaimSeat}
              onAddFriend={onAddFriend}
              onToggleMute={onToggleMute}
            />
          </View>
        </LandscapePane>
      </LandscapeFrame>
    );
  }

  return (
    <LandscapeFrame title={t(language, 'room')} backLabel={t(language, 'back')} onBack={onLeave}>
      <LandscapePane>
        <ScrollView contentContainerStyle={styles.roomMeta} keyboardShouldPersistTaps="handled">
          <Text style={styles.code}>{room.code}</Text>
          {onShare ? <UiButton label={t(language, 'shareRoom')} onPress={onShare} /> : null}
          {room.pendingJoins && room.pendingJoins.length > 0 && onRespondJoin ? (
            <View style={styles.roomActions}>
              <Text style={styles.body}>{t(language, 'joinRequests')}</Text>
              {room.pendingJoins.map((row) => (
                <View key={row.fromId} style={styles.inviteRow}>
                  <Text style={styles.inviteName} numberOfLines={1}>
                    {row.username}
                  </Text>
                  <UiButton
                    label={t(language, 'allowJoin')}
                    variant="ghost"
                    onPress={() => onRespondJoin(row.fromId, true)}
                    style={styles.inviteBtn}
                  />
                  <UiButton
                    label={t(language, 'denyJoin')}
                    variant="ghost"
                    onPress={() => onRespondJoin(row.fromId, false)}
                    style={styles.inviteBtn}
                  />
                </View>
              ))}
            </View>
          ) : null}
          {waiting.length > 0 ? (
            <Text style={styles.body}>{t(language, 'waitingToReady', { names: waiting.join(', ') })}</Text>
          ) : null}
          <View style={styles.roomActions}>
            {onToggleMute && you?.ready && !you.isBot ? (
              <UiButton
                label={you.muted ? t(language, 'voiceOff') : t(language, 'voiceOn')}
                variant={you.muted ? 'secondary' : 'go'}
                onPress={onToggleMute}
              />
            ) : null}
            <UiButton label={t(language, 'fillBots')} variant="secondary" onPress={onFillBots} />
            <UiButton
              label={t(language, 'start')}
              disabled={!canStart}
              onPress={() => {
                if (!roomIsReady(room)) {
                  Alert.alert(t(language, 'start'), t(language, 'seatsNotReady'));
                  return;
                }
                if (!guestsAreReady(room)) {
                  Alert.alert(t(language, 'start'), t(language, 'playersNotReady'));
                  return;
                }
                onStart();
              }}
            />
          </View>
          {friends.length > 0 && onInvite ? (
            <View style={styles.roomActions}>
              <Text style={styles.body}>{t(language, 'inviteFriend')}</Text>
              {friends.slice(0, 4).map((friend) => {
                const myTeam = (localSeatOf(room) % 2) as 0 | 1;
                const oppTeam = myTeam === 0 ? 1 : 0;
                return (
                  <View key={friend.id} style={styles.inviteRow}>
                    <Text style={styles.inviteName} numberOfLines={1}>
                      {friend.username}
                    </Text>
                    <UiButton
                      label={t(language, 'inviteTeam')}
                      variant="ghost"
                      onPress={() => onInvite(friend.username, myTeam)}
                      style={styles.inviteBtn}
                    />
                    <UiButton
                      label={t(language, 'inviteOpp')}
                      variant="ghost"
                      onPress={() => onInvite(friend.username, oppTeam)}
                      style={styles.inviteBtn}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      </LandscapePane>
      <LandscapePane>
        <View style={styles.right}>
          <RoomSeats
            language={language}
            room={room}
            friends={friends}
            onClaimSeat={onClaimSeat}
            onAddFriend={onAddFriend}
            onToggleMute={onToggleMute}
          />
          <ChatPanel
            language={language}
            messages={chat}
            localSeat={localSeatOf(room)}
            onSend={onSendChat}
            compact
          />
        </View>
      </LandscapePane>
    </LandscapeFrame>
  );
}

function RoomSeats({
  language,
  room,
  friends,
  onClaimSeat,
  onAddFriend,
  onToggleMute,
}: {
  language: Language;
  room: GameRoom;
  friends: PublicPlayer[];
  onClaimSeat?: (seat: number) => void;
  onAddFriend?: (username: string) => void;
  onToggleMute?: () => void;
}) {
  return (
    <View style={styles.teams}>
      <TeamColumn
        language={language}
        room={room}
        team={0}
        friends={friends}
        onClaimSeat={onClaimSeat}
        onAddFriend={onAddFriend}
        onToggleMute={onToggleMute}
      />
      <TeamColumn
        language={language}
        room={room}
        team={1}
        friends={friends}
        onClaimSeat={onClaimSeat}
        onAddFriend={onAddFriend}
        onToggleMute={onToggleMute}
      />
    </View>
  );
}

function seatStatus(language: Language, seat: RoomSeat, canSwitch: boolean): string {
  if (canSwitch) {
    return t(language, 'tapToSwitch');
  }
  if (seat.connection === 'disconnected' || seat.connection === 'failed') {
    return t(language, 'disconnected');
  }
  if (seat.connection === 'reconnecting' || seat.connection === 'restoring') {
    return t(language, 'playerReconnecting');
  }
  if (seat.isBot) {
    return t(language, 'botSeat');
  }
  if (seat.ready && !seat.isHost && !seat.lobbyReady) {
    return t(language, 'waiting');
  }
  if (seat.ready) {
    return t(language, 'ready');
  }
  return t(language, 'sitHere');
}

function TeamColumn({
  language,
  room,
  team,
  friends,
  onClaimSeat,
  onAddFriend,
  onToggleMute,
}: {
  language: Language;
  room: GameRoom;
  team: 0 | 1;
  friends: PublicPlayer[];
  onClaimSeat?: (seat: number) => void;
  onAddFriend?: (username: string) => void;
  onToggleMute?: () => void;
}) {
  const youTeam = (localSeatOf(room) % 2) as 0 | 1;
  const indexes = team === 0 ? [0, 2] : [1, 3];
  return (
    <View style={[styles.teamCol, team === 1 && styles.teamColOpp]}>
      <Text style={[styles.teamTitle, team === 1 && styles.teamTitleOpp]}>
        {t(language, team === 0 ? 'team1' : 'team2')}
        {youTeam === team ? ` · ${t(language, 'yourTeam')}` : ''}
      </Text>
      {indexes.map((index) => (
        <SeatCard
          key={index}
          language={language}
          seat={room.seats[index]!}
          index={index}
          started={room.started}
          friends={friends}
          stacked
          partner={!room.seats[index]?.isYou && localSeatOf(room) % 2 === index % 2}
          onClaimSeat={onClaimSeat}
          onAddFriend={onAddFriend}
          onToggleMute={onToggleMute}
        />
      ))}
    </View>
  );
}

function SeatCard({
  language,
  seat,
  index,
  started,
  stacked,
  partner,
  friends = [],
  onClaimSeat,
  onAddFriend,
  onToggleMute,
}: {
  language: Language;
  seat: RoomSeat;
  index: number;
  started: boolean;
  stacked?: boolean;
  partner?: boolean;
  friends?: PublicPlayer[];
  onClaimSeat?: (seat: number) => void;
  onAddFriend?: (username: string) => void;
  onToggleMute?: () => void;
}) {
  const vacant = !seat.ready || seat.isBot;
  const occupiedHuman = Boolean(onClaimSeat) && !started && seat.ready && !seat.isBot && !seat.isYou;
  const open = !started && Boolean(onClaimSeat) && !seat.isYou;
  const canAdd =
    Boolean(onAddFriend) &&
    seat.ready &&
    !seat.isBot &&
    !seat.isYou &&
    !friends.some((friend) => friend.username === seat.name);
  const voice = seat.ready
    ? {
        muted: seat.muted,
        speaking: seat.speaking,
        available: seat.voiceAvailable !== false,
        canControl: Boolean(onToggleMute && seat.isYou && !seat.isBot),
        onToggle: onToggleMute,
      }
    : null;
  return (
    <View
      style={[
        styles.seat,
        stacked && styles.seatStacked,
        stacked && index % 2 === 1 && styles.seatOpp,
        seat.isYou && styles.seatYou,
        open && vacant && styles.seatOpen,
        occupiedHuman && styles.seatSwitch,
      ]}
    >
      <View style={styles.seatRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!open}
          onPress={() => onClaimSeat?.(index)}
          style={styles.seatHit}
        >
          <Text style={styles.seatName} numberOfLines={1}>
            {seat.isYou ? t(language, 'you') : seat.ready ? seat.name : t(language, 'emptySeat')}
          </Text>
          <Text style={styles.seatMeta}>
            {partner && seat.ready && !seat.isYou ? `${t(language, 'partnerSeat')} · ` : ''}
            {seat.speaking && !seat.muted ? t(language, 'voiceLive') : seatStatus(language, seat, occupiedHuman)}
          </Text>
        </Pressable>
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
      </View>
      {canAdd ? (
        <UiButton
          label={t(language, 'sendRequest')}
          variant="ghost"
          onPress={() => onAddFriend?.(seat.name)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingRight: spacing.sm,
  },
  join: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: colors.cream,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLight,
    color: colors.cream,
    paddingHorizontal: 16,
    letterSpacing: 6,
    fontSize: 20,
    fontWeight: '800',
  },
  roomMeta: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  code: {
    color: colors.gold,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 10,
    fontFamily: fonts.sans,
  },
  roomActions: {
    gap: spacing.sm,
  },
  right: {
    flex: 1,
    minHeight: 0,
    gap: spacing.sm,
  },
  teams: {
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 0,
  },
  teamCol: {
    flex: 1,
    gap: 6,
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.team1,
  },
  teamColOpp: {
    borderColor: colors.team2,
  },
  teamTitle: {
    color: colors.team1,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  teamTitleOpp: {
    color: colors.team2,
  },
  seat: {
    width: '48%',
    flexGrow: 1,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    gap: 4,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seatHit: {
    flexGrow: 1,
    minWidth: 0,
  },
  seatStacked: {
    width: '100%',
  },
  seatOpp: {
    borderColor: 'rgba(224, 91, 76, 0.35)',
  },
  seatYou: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(232, 197, 71, 0.12)',
  },
  seatOpen: {
    borderStyle: 'dashed',
  },
  seatSwitch: {
    borderColor: 'rgba(232, 197, 71, 0.45)',
  },
  inviteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  inviteName: {
    color: colors.cream,
    fontWeight: '700',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 72,
  },
  inviteBtn: {
    flexShrink: 0,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  seatName: {
    color: colors.cream,
    fontWeight: '700',
  },
  seatMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});
