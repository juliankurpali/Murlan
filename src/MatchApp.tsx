import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AudioModule } from 'expo-audio';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  AppSettings,
  applyAutoTurn,
  applyBotTurn,
  initialSession,
  matchIsUnfinished,
  nextHand,
  peekBotAction,
  sessionReducer,
  startMatch,
  submitExchange,
  submitPass,
  submitPlay,
} from './application';
import {
  nextBotReactionDelay,
  BOT_REACTIONS_ENABLED,
  pickBotReaction,
  REACTION_COOLDOWN_MS,
  REACTION_DURATION_MS,
  REACTION_VISIBLE_MAX,
  type ReactionEvent,
} from './reactions';
import {
  Card,
  GameState,
  DEFAULT_RULES,
  explainExchangeSelection,
  explainSelection,
  isRuleError,
  legalMovesForSeat,
  mathRandomSource,
  PublicChaosView,
  SeatId,
  toPublicView,
} from './domain';
import { ConfirmDialog } from './components/ConfirmDialog';
import { FullscreenMark } from './components/FullscreenMark';
import { TermsGate } from './components/TermsGate';
import { UsernamePrompt } from './components/UsernamePrompt';
import { RotateHint } from './components/RotateHint';
import { configureFeel, feel, startTableMusic, stopTableMusic } from './feel';
import { VoiceChannel, type MicCaptureStatus } from './feel/VoiceChannel';
import { playSeatVoice, setVoicePlaybackMode } from './feel/voicePlay';
import {
  bindNet,
  connectNet,
  NetStatus,
  sendChat,
  sendIntent,
  sendReaction,
  netId,
  sendLeave,
  sendMute,
  sendSpeaking,
  sendVoice,
  sendVoiceStatus,
  setSessionToken,
  setWatchGame,
  watchTable,
} from './online/net';
import { ChatMessage } from './online/chat';
import { adminFlagFromLink, clearAdminFromAddressBar, clearJoinFromAddressBar, joinCodeFromLink, shareRoomLink } from './online/joinLink';
import { botSeatsOf, GameRoom, localSeatOf, RoomSeat, seatsForMode } from './online/room';
import * as Linking from 'expo-linking';
import { t, tError } from './i18n';
import { isGeneratedUsername, isUsername, normalizeUsername } from './platform/ids';
import {
  EMPTY_SERIES,
  Friendship,
  GameSummary,
  JoinOutcome,
  MatchHistoryRow,
  PlatformNotice,
  PublicPlayer,
  TableSeries,
} from './platform/types';
import { matchFromView } from './platform/viewMatch';
import { AdminScreen } from './screens/AdminScreen';
import { HandResultScreen } from './screens/HandResultScreen';
import { LegalScreen } from './screens/LegalScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RulesScreen } from './screens/RulesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SetupScreen } from './screens/SetupScreen';
import { SocialHubScreen } from './screens/SocialHubScreen';
import { TableScreen } from './screens/TableScreen';
import {
  clearMatch,
  loadAuth,
  loadLegalVersion,
  loadPlayerKey,
  loadSettings,
  loadTableSession,
  loadUsernamePrompt,
  saveAuth,
  saveLegalVersion,
  saveSettings,
  saveTableSession,
  saveUsernamePrompt,
} from './storage';
import {
  claimSeat,
  createGame,
  createGuest,
  fetchMe,
  fetchProfile,
  fillGameBots,
  joinGame,
  joinGameById,
  leaveGame,
  markInboxRead,
  respondJoin,
  respondSwitch,
  patchMe,
  requestFriend,
  respondFriend,
  setApiToken,
  startGame,
  setGameMode,
  setLobbyReady,
  inviteToGame,
} from './social/api';
import { TERMS_VERSION } from './legal';
import type { LegalKind } from './legal/types';
import { colors, motion } from './theme';
import {
  fullscreenAvailable,
  fullscreenKind,
  isFullscreen,
  subscribeFullscreen,
  toggleFullscreen,
} from './webFullscreen';

type InvitePrompt = {
  kind: 'join' | 'mid' | 'admit' | 'switch' | 'friend';
  name: string;
  gameId: string;
  code: string;
  fromId?: string;
  requestId?: string;
};

type RoomResult = GameSummary | JoinOutcome;

function waitingSeatNames(seats: RoomSeat[] | undefined, ready: SeatId[]): string[] {
  return (seats ?? [])
    .map((seat, index) => ({ seat, index }))
    .filter(
      ({ seat, index }) =>
        Boolean(seat.ready) && !seat.isBot && !seat.isYou && !ready.includes(index as SeatId),
    )
    .map(({ seat }) => seat.name);
}

function addSeriesWin(series: TableSeries, winner: GameState['winner']): TableSeries {
  const teamWins = [...series.teamWins];
  const seatWins = [...series.seatWins];
  const bumpTeam = (team: number, seats: number[]) => {
    teamWins[team] = (teamWins[team] ?? 0) + 1;
    for (const seat of seats) {
      seatWins[seat] = (seatWins[seat] ?? 0) + 1;
    }
  };
  if (winner === 'team0') {
    bumpTeam(0, seatWins.length === 6 ? [0, 3] : [0, 2]);
  } else if (winner === 'team1') {
    bumpTeam(1, seatWins.length === 6 ? [1, 4] : [1, 3]);
  } else if (winner === 'team2') {
    bumpTeam(2, [2, 5]);
  } else if (typeof winner === 'number') {
    seatWins[winner] = (seatWins[winner] ?? 0) + 1;
    const team = seatWins.length === 6 ? winner % 3 : winner % 2;
    teamWins[team] = (teamWins[team] ?? 0) + 1;
  }
  return { matches: series.matches + 1, teamWins, seatWins };
}

function durationForCurrentTurn(
  match: GameState,
  botSeats: number[],
  localSeat: SeatId,
  online: boolean,
): number {
  const botTurn = botSeats.includes(match.currentSeat);
  if (!botTurn) {
    return motion.humanTurnMs;
  }
  const action = !online ? peekBotAction(match, localSeat, botSeats) : null;
  return action?.type === 'pass' ? motion.botPassMs : motion.botPlayMs;
}

export function MatchApp() {
  const [session, dispatch] = useReducer(sessionReducer, initialSession());
  const [onlineRoom, setOnlineRoom] = useState<GameRoom | null>(null);
  const [netStatus, setNetStatus] = useState<NetStatus>('idle');
  const [netError, setNetError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [reactionCoolUntil, setReactionCoolUntil] = useState(0);
  const seenReactions = useRef(new Set<string>());
  const [nextHandReady, setNextHandReady] = useState<SeatId[]>([]);
  const [playAgainReady, setPlayAgainReady] = useState<SeatId[]>([]);
  const [series, setSeries] = useState<TableSeries>(EMPTY_SERIES);
  const [chaosView, setChaosView] = useState<PublicChaosView | null>(null);
  const [micStatus, setMicStatus] = useState<MicCaptureStatus>('muted');
  const [me, setMe] = useState<PublicPlayer | null>(null);
  const [friends, setFriends] = useState<PublicPlayer[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [inbox, setInbox] = useState<PlatformNotice[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [profileHistory, setProfileHistory] = useState<MatchHistoryRow[]>([]);
  const [profileFriends, setProfileFriends] = useState<PublicPlayer[]>([]);
  const [invitePrompt, setInvitePrompt] = useState<InvitePrompt | null>(null);
  const [endedPrompt, setEndedPrompt] = useState<{ code: string } | null>(null);
  const [usernamePrompt, setUsernamePrompt] = useState<'first' | 'change' | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [joinWaiting, setJoinWaiting] = useState<string | null>(null);
  const screenRef = useRef(session.screen);
  const restoreRef = useRef(false);
  const settingsFromTable = useRef(false);
  const seenNoticeIds = useRef(new Set<string>());
  const seenFriendRequestIds = useRef(new Set<string>());
  const noticesReady = useRef(false);
  const tableGameIdRef = useRef<string | null>(null);
  const seriesTalliedRef = useRef(false);
  const usernameFlagsRef = useRef({ seenFirst: false, nudgeDismissed: false });
  const startFreshRef = useRef<(factory: () => Promise<RoomResult>) => Promise<void>>(async () => undefined);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState<LegalKind | null>(null);
  const [legalVersion, setLegalVersion] = useState<number | null>(null);
  const [fullScreenOn, setFullScreenOn] = useState(isFullscreen);
  const localSeat = localSeatOf(onlineRoom) as SeatId;
  const botSeats = botSeatsOf(onlineRoom);
  const online = Boolean(onlineRoom);
  const canResume = online && matchIsUnfinished(session.match);
  const commitMatch = useCallback((match: GameState) => {
    if (!tableGameIdRef.current && match.phase === 'matchComplete' && !seriesTalliedRef.current) {
      seriesTalliedRef.current = true;
      setSeries((prev) => addSeriesWin(prev, match.winner));
    }
    if (match.phase !== 'matchComplete') {
      seriesTalliedRef.current = false;
    }
    dispatch({ type: 'setMatch', match });
  }, []);

  useEffect(() => {
    screenRef.current = session.screen;
  }, [session.screen]);

  const openGame = useCallback((gameId: string, resume = false) => {
    if (resume) {
      restoreRef.current = true;
    }
    tableGameIdRef.current = gameId;
    setWatchGame(gameId);
    void saveTableSession({ gameId });
    watchTable(gameId);
  }, []);

  const detachFromTable = useCallback(() => {
    restoreRef.current = false;
    tableGameIdRef.current = null;
    setWatchGame(null);
    void saveTableSession(null);
    setOnlineRoom(null);
    setNetError(null);
    setChat([]);
    setReactions([]);
    setReactionCoolUntil(0);
    seenReactions.current.clear();
    setNextHandReady([]);
    setMicStatus('muted');
    void clearMatch();
    dispatch({ type: 'setMatch', match: null });
  }, []);

  useEffect(() => {
    void (async () => {
      const [settings, identity, auth, tableSession, promptFlags, acceptedLegal] = await Promise.all([
        loadSettings(),
        loadPlayerKey(),
        loadAuth(),
        loadTableSession(),
        loadUsernamePrompt(),
        loadLegalVersion(),
      ]);
      setLegalVersion(acceptedLegal);
      dispatch({ type: 'hydrate', match: null, settings });
      await clearMatch();
      const hadSession = Boolean(auth?.token);
      usernameFlagsRef.current = promptFlags;
      try {
        setApiToken(auth?.token ?? null);
        let player = null as PublicPlayer | null;
        if (auth?.token) {
          try {
            player = (await fetchMe()).player;
          } catch {
            player = null;
          }
        }
        if (!player) {
          const guest = await createGuest(identity);
          player = guest.player;
          await saveAuth({ token: guest.token, playerId: guest.player.id });
        }
        const latest = await loadAuth();
        setMe(player);
        setSessionToken(latest?.token ?? auth?.token ?? null);
        const generated = isGeneratedUsername(player.username);
        if (!generated) {
          if (!promptFlags.seenFirst || !promptFlags.nudgeDismissed) {
            const next = { seenFirst: true, nudgeDismissed: true };
            usernameFlagsRef.current = next;
            void saveUsernamePrompt(next);
          }
        } else if (!hadSession && !promptFlags.seenFirst) {
          const next = { ...promptFlags, seenFirst: true };
          usernameFlagsRef.current = next;
          void saveUsernamePrompt(next);
          setUsernamePrompt('first');
        } else if (!promptFlags.nudgeDismissed) {
          setUsernamePrompt('change');
        }
        await connectNet();
        if (tableSession?.gameId && !tableSession.parked) {
          restoreRef.current = true;
          openGame(tableSession.gameId, true);
        }
      } catch {
        setNetError('relayDown');
      }
    })();
  }, [openGame]);

  useEffect(() => {
    bindNet({
      onStatus: setNetStatus,
      onRoom: (room) => {
        setOnlineRoom(room);
        setNetError(null);
        if (restoreRef.current && !room.started) {
          restoreRef.current = false;
          dispatch({ type: 'navigate', screen: 'lobby' });
        }
      },
      onError: (message) => {
        setNetError(message);
        if (message === 'session-expired') {
          detachFromTable();
        }
      },
      onEnded: (gameId, reason, code) => {
        if (tableGameIdRef.current !== gameId) {
          return;
        }
        detachFromTable();
        dispatch({ type: 'navigate', screen: 'home' });
        if (reason === 'admin') {
          setInvitePrompt(null);
          setEndedPrompt({ code: code || '—' });
        }
      },
      onView: (table) => {
        setNextHandReady(table.nextHandReady ?? []);
        setPlayAgainReady(table.playAgainReady ?? []);
        if (table.series) {
          setSeries(table.series);
        }
        setChaosView(table.chaos ?? null);
        commitMatch(matchFromView(table.view));
        const restoring = restoreRef.current;
        const parked =
          !restoring &&
          (screenRef.current === 'home' ||
            screenRef.current === 'rules' ||
            screenRef.current === 'settings' ||
            screenRef.current === 'social' ||
            screenRef.current === 'profile');
        if (parked) {
          return;
        }
        restoreRef.current = false;
        dispatch({
          type: 'navigate',
          screen: table.view.phase === 'playing' || table.view.phase === 'exchanging' ? 'table' : 'handResult',
        });
      },
      onSocial: (payload) => {
        setMe(payload.me);
        setFriends(payload.friends);
        setRequests(payload.requests);
        setInbox(payload.inbox);
        setGames(payload.games);
      },
      onVoice: (frame) => playSeatVoice(frame),
      onChat: (message) => setChat((prev) => [...prev, message].slice(-40)),
      onChatHistory: setChat,
      onReaction: (event) => {
        if (seenReactions.current.has(event.eventId)) {
          return;
        }
        if (Date.now() - event.serverTimestamp > REACTION_DURATION_MS + 400) {
          return;
        }
        seenReactions.current.add(event.eventId);
        setReactions((prev) => [...prev, event].slice(-REACTION_VISIBLE_MAX));
        if (event.senderPlayerId === netId()) {
          setReactionCoolUntil(event.serverTimestamp + REACTION_COOLDOWN_MS);
        }
        setTimeout(() => {
          seenReactions.current.delete(event.eventId);
          setReactions((prev) => prev.filter((row) => row.eventId !== event.eventId));
        }, REACTION_DURATION_MS);
      },
      onReactionDenied: () => {
        /* display-only: invalid sends are dropped, nothing is stored */
      },
    });
    return () => bindNet({});
  }, [commitMatch, detachFromTable]);

  useEffect(() => {
    const seen = seenNoticeIds.current;
    const handled: string[] = [];
    const done = (item: PlatformNotice) => {
      seen.add(item.id);
      if (!item.read) {
        handled.push(item.id);
      }
    };
    const gameOf = (item: PlatformNotice) => games.find((row) => row.id === item.gameId);
    const actionable = (item: PlatformNotice): boolean => {
      if (item.read) {
        return false;
      }
      const game = gameOf(item);
      if (!game || game.status !== 'lobby') {
        return false;
      }
      if (item.kind === 'join-request') {
        return game.createdBy === me?.id && Boolean(game.pendingJoins?.some((row) => row.fromId === item.fromId));
      }
      if (item.kind === 'seat-switch') {
        return game.seats.some((seat) => seat.isYou) && game.seats.some((seat) => seat.userId === item.fromId);
      }
      if (item.kind === 'invite') {
        return game.invited && !game.seats.some((seat) => seat.isYou);
      }
      return false;
    };
    if (!noticesReady.current) {
      noticesReady.current = true;
      for (const item of inbox) {
        if (actionable(item) || item.kind === 'friend-request' || (item.kind === 'game-ended' && !item.read)) {
          continue;
        }
        seen.add(item.id);
        if (
          !item.read &&
          (item.kind === 'invite' || item.kind === 'join-request' || item.kind === 'seat-switch')
        ) {
          handled.push(item.id);
        }
      }
    }
    const busy =
      session.screen === 'table' || session.screen === 'handResult' || session.screen === 'lobby';
    const labelFor = (item: PlatformNotice) =>
      friends.find((row) => row.id === item.fromId)?.username ??
      requests.find((row) => row.requesterId === item.fromId)?.fromUsername ??
      gameOf(item)?.seats.find((seat) => seat.userId === item.fromId)?.name ??
      'Player';
    const order = (item: PlatformNotice) =>
      item.kind === 'game-ended'
        ? -1
        : item.kind === 'join-request'
          ? 0
          : item.kind === 'seat-switch'
            ? 1
            : item.kind === 'invite'
              ? 2
              : 3;
    const incoming = inbox.filter((item) => !seen.has(item.id)).sort((a, b) => order(a) - order(b));
    try {
      for (const item of incoming) {
        if (item.read) {
          seen.add(item.id);
          continue;
        }
        if (item.kind === 'game-ended') {
          done(item);
          if (item.gameId && tableGameIdRef.current === item.gameId) {
            detachFromTable();
            dispatch({ type: 'navigate', screen: 'home' });
          }
          if (!endedPrompt) {
            const fromBody = item.body.match(/Room\s+(\S+)/)?.[1] ?? '';
            setInvitePrompt(null);
            setEndedPrompt({ code: fromBody || '—' });
          }
          return;
        }
        if (item.kind === 'join-request' || item.kind === 'seat-switch' || item.kind === 'invite') {
          if (!actionable(item) || !item.gameId || !item.fromId) {
            done(item);
            continue;
          }
          if (invitePrompt || endedPrompt || (item.kind === 'invite' && busy)) {
            continue;
          }
          done(item);
          setInvitePrompt({
            kind: item.kind === 'join-request' ? 'admit' : item.kind === 'seat-switch' ? 'switch' : 'join',
            name: labelFor(item),
            gameId: item.gameId,
            code: gameOf(item)?.code ?? '',
            fromId: item.kind === 'invite' ? undefined : item.fromId,
          });
          return;
        }
        done(item);
        if (item.kind === 'join-accepted' && item.gameId) {
          const gameId = item.gameId;
          setJoinWaiting(null);
          queueMicrotask(() => {
            void startFreshRef.current(() => joinGameById(gameId));
          });
          return;
        }
        if (item.kind === 'join-denied') {
          setJoinWaiting(null);
          Alert.alert(t(session.settings.language, 'joinRoom'), t(session.settings.language, 'joinDenied'));
          return;
        }
        if (item.kind === 'seat-switch-denied') {
          Alert.alert(t(session.settings.language, 'switchSeats'), t(session.settings.language, 'switchDenied'));
          return;
        }
      }
    } finally {
      void markInboxRead(handled);
    }
  }, [
    inbox,
    games,
    friends,
    requests,
    me,
    session.screen,
    session.settings.language,
    invitePrompt,
    endedPrompt,
    detachFromTable,
  ]);

  useEffect(() => {
    if (invitePrompt || endedPrompt || usernamePrompt || !me) {
      return;
    }
    const pending = requests.find(
      (row) =>
        row.status === 'pending' &&
        row.addresseeId === me.id &&
        !seenFriendRequestIds.current.has(row.id),
    );
    if (!pending) {
      return;
    }
    seenFriendRequestIds.current.add(pending.id);
    setInvitePrompt({
      kind: 'friend',
      name: pending.fromUsername ?? 'Player',
      gameId: '',
      code: '',
      fromId: pending.requesterId,
      requestId: pending.id,
    });
  }, [requests, me, invitePrompt, endedPrompt, usernamePrompt]);

  useEffect(() => {
    configureFeel({
      sound: session.settings.sound,
      music: session.settings.music,
      haptics: session.settings.haptics,
    });
    setVoicePlaybackMode(session.settings.voiceMode);
  }, [session.settings.sound, session.settings.music, session.settings.haptics, session.settings.voiceMode]);

  const voiceScreen =
    session.screen === 'table' || session.screen === 'handResult' || session.screen === 'lobby';
  const micOpen = Boolean(
    online && voiceScreen && !(onlineRoom?.seats[localSeat]?.muted ?? true),
  );

  useEffect(() => {
    if (session.screen !== 'table') {
      stopTableMusic();
      return;
    }
    if (micOpen) {
      stopTableMusic();
      return;
    }
    void startTableMusic();
    return () => stopTableMusic();
  }, [session.screen, micOpen]);

  const skipFeel = useRef(true);
  const wasHumanTurn = useRef(false);
  useEffect(() => {
    if (session.screen !== 'table' || !session.match) {
      skipFeel.current = true;
      wasHumanTurn.current = false;
      return;
    }
    if (skipFeel.current) {
      skipFeel.current = false;
      return;
    }
    const last = session.match.history[session.match.history.length - 1];
    if (last?.kind === 'play') {
      void feel('play');
    } else if (last?.kind === 'pass') {
      void feel('pass');
    } else if (!last) {
      void feel('deal');
    }
    if (session.match.phase === 'handComplete' || session.match.phase === 'matchComplete') {
      void feel('win');
      return;
    }
    const humanTurn =
      session.match.currentSeat === localSeat &&
      (session.match.phase === 'playing' || session.match.phase === 'exchanging');
    if (humanTurn && !wasHumanTurn.current) {
      void feel('turn');
    }
    wasHumanTurn.current = humanTurn;
  }, [session.match?.history.length, session.match?.phase, session.match?.currentSeat, session.screen, localSeat]);

  const goHome = () => {
    dispatch({ type: 'navigate', screen: 'home' });
  };

  const leaveOnline = () => {
    if (onlineRoom?.id) {
      void leaveGame(onlineRoom.id);
    }
    sendLeave();
    detachFromTable();
    dispatch({ type: 'navigate', screen: 'social' });
  };

  const leaveTable = () => {
    if (!onlineRoom) {
      void clearMatch();
      setSeries(EMPTY_SERIES);
      setPlayAgainReady([]);
      seriesTalliedRef.current = false;
      dispatch({ type: 'setMatch', match: null });
      dispatch({ type: 'navigate', screen: 'home' });
      return;
    }
    const gameId = onlineRoom.id;
    sendLeave();
    tableGameIdRef.current = gameId;
    void saveTableSession({ gameId, parked: true });
    dispatch({ type: 'navigate', screen: 'home' });
    void leaveGame(gameId)
      .then((result) => {
        if (result.ended) {
          detachFromTable();
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => undefined);
  }, []);

  const turnKey =
    session.match && (session.screen === 'table' || online)
      ? `${session.match.handIndex}-${session.match.currentSeat}-${session.match.history.length}-${session.match.phase}-${localSeat}-${botSeats.join('.')}`
      : '';
  useEffect(() => {
    const match = session.match;
    if (!match || (session.screen !== 'table' && !online)) {
      return;
    }
    if (match.phase === 'handComplete' || match.phase === 'matchComplete') {
      if (session.screen !== 'table') {
        return;
      }
      const handle = setTimeout(() => {
        dispatch({ type: 'navigate', screen: 'handResult' });
      }, motion.handResultMs);
      return () => clearTimeout(handle);
    }
    const botTurn = botSeats.includes(match.currentSeat);
    const dealDelay = match.history.length === 0 ? motion.dealMs : 0;
    const duration = durationForCurrentTurn(match, botSeats, localSeat, online);
    let turnHandle: ReturnType<typeof setTimeout> | undefined;
    const startTurn = () => {
      if (online) {
        return;
      }
      turnHandle = setTimeout(() => {
        const result = botTurn
          ? applyBotTurn(match, localSeat, botSeats)
          : applyAutoTurn(match, match.currentSeat);
        if (isRuleError(result)) {
          dispatch({ type: 'setError', error: result.message });
          return;
        }
        commitMatch(result);
      }, duration);
    };
    const dealHandle = setTimeout(startTurn, dealDelay);
    return () => {
      clearTimeout(dealHandle);
      if (turnHandle) {
        clearTimeout(turnHandle);
      }
    };
  }, [turnKey, commitMatch, online, botSeats, localSeat]);

  const botReactLive =
    BOT_REACTIONS_ENABLED &&
    !online &&
    session.screen === 'table' &&
    Boolean(session.match) &&
    (session.match?.phase === 'playing' || session.match?.phase === 'exchanging') &&
    botSeats.length > 0;
  const botSeatKey = botSeats.join('.');
  const tableSeatCount = session.match?.hands.length ?? 4;
  useEffect(() => {
    if (!botReactLive) {
      return;
    }
    const bots = botSeatKey.split('.').map((value) => Number(value)).filter((value) => Number.isInteger(value));
    let handle: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const arm = () => {
      handle = setTimeout(() => {
        if (cancelled) {
          return;
        }
        const occupants = Array.from({ length: tableSeatCount }, (_, index) => ({
          id: bots.includes(index) ? `bot:local:${index}` : index === localSeat ? 'local' : `seat:${index}`,
          seat: index,
        }));
        const pick = pickBotReaction(
          occupants,
          bots.map((seat) => `bot:local:${seat}`),
        );
        if (pick) {
          const sender = occupants.find((row) => row.id === pick.senderId);
          const target = occupants.find((row) => row.id === pick.targetPlayerId);
          const event: ReactionEvent = {
            eventId: `bot-${Date.now()}-${pick.requestId}`,
            roomId: 'local',
            senderPlayerId: pick.senderId,
            senderSeat: sender?.seat,
            targetPlayerId: pick.targetPlayerId,
            targetSeat: target?.seat,
            reactionId: pick.reactionId,
            requestId: pick.requestId,
            serverTimestamp: Date.now(),
          };
          if (!seenReactions.current.has(event.eventId)) {
            seenReactions.current.add(event.eventId);
            setReactions((prev) => [...prev, event].slice(-REACTION_VISIBLE_MAX));
            setTimeout(() => {
              seenReactions.current.delete(event.eventId);
              setReactions((prev) => prev.filter((row) => row.eventId !== event.eventId));
            }, REACTION_DURATION_MS);
          }
        }
        arm();
      }, nextBotReactionDelay());
    };
    arm();
    return () => {
      cancelled = true;
      if (handle) {
        clearTimeout(handle);
      }
    };
  }, [botReactLive, botSeatKey, localSeat, tableSeatCount]);

  const view = session.match ? toPublicView(session.match, localSeat) : null;
  const exchanging = session.match?.phase === 'exchanging';
  const legalMoves = useMemo(
    () => (session.match && session.match.phase === 'playing' ? legalMovesForSeat(session.match, localSeat) : []),
    [session.match, localSeat],
  );
  const legalCardIds = useMemo(() => {
    if (session.match?.phase === 'exchanging' && session.match.pendingExchange) {
      const receivedId = session.match.pendingExchange.givenToFirst.id;
      return new Set(session.match.hands[localSeat].map((card) => card.id).filter((id) => id !== receivedId));
    }
    const ids = new Set<string>();
    for (const move of legalMoves) {
      for (const card of move) {
        ids.add(card.id);
      }
    }
    return ids;
  }, [legalMoves, session.match, localSeat]);

  const selectedCards: Card[] = view
    ? view.ownHand.filter((card) => session.selectedIds.includes(card.id))
    : [];
  const selectionError =
    session.match && selectedCards.length > 0
      ? exchanging
        ? explainExchangeSelection(session.match, localSeat, selectedCards)
        : explainSelection(session.match, localSeat, selectedCards)
      : null;
  const selectionLegal = selectedCards.length === 0 ? null : selectionError === null;

  const beginMatch = (language: AppSettings['language']) => {
    const match = startMatch();
    dispatch({ type: 'setSettings', settings: { language } });
    void saveSettings({ ...session.settings, language });
    setSeries(EMPTY_SERIES);
    setPlayAgainReady([]);
    seriesTalliedRef.current = false;
    commitMatch(match);
    dispatch({ type: 'navigate', screen: 'table' });
    void feel('deal');
  };

  const resume = () => {
    const active =
      onlineRoom?.id ?? games.find((game) => game.status === 'playing' && game.seats.some((seat) => seat.isYou))?.id;
    if (active) {
      openGame(active, true);
      return;
    }
    if (!session.match) {
      return;
    }
    dispatch({
      type: 'navigate',
      screen:
        session.match.phase === 'playing' || session.match.phase === 'exchanging' ? 'table' : 'handResult',
    });
  };

  const playSelected = () => {
    if (!session.match) {
      return;
    }
    if (session.match.phase === 'exchanging') {
      const card = selectedCards[0];
      if (!card || selectedCards.length !== 1) {
        dispatch({ type: 'setError', error: 'Choose one card to give to last place.' });
        return;
      }
      if (online) {
        sendIntent('exchange', { cardId: card.id });
        return;
      }
      const exchanged = submitExchange(session.match, card, localSeat);
      if (isRuleError(exchanged)) {
        void feel('illegal');
        dispatch({ type: 'setError', error: exchanged.message });
        return;
      }
      commitMatch(exchanged);
      return;
    }
    if (online) {
      sendIntent('play', { cards: selectedCards.map((item) => item.id) });
      return;
    }
    const result = submitPlay(session.match, selectedCards, localSeat);
    if (isRuleError(result)) {
      void feel('illegal');
      dispatch({ type: 'setError', error: result.message });
      return;
    }
    commitMatch(result);
  };

  const passTurn = () => {
    if (!session.match) {
      return;
    }
    if (online) {
      sendIntent('pass');
      return;
    }
    const result = submitPass(session.match, localSeat);
    if (isRuleError(result)) {
      void feel('illegal');
      dispatch({ type: 'setError', error: result.message });
      return;
    }
    commitMatch(result);
  };

  const dealNext = () => {
    if (!session.match) {
      return;
    }
    if (online) {
      sendIntent('nextHand');
      return;
    }
    const result = nextHand(session.match, mathRandomSource(), botSeats);
    if (isRuleError(result)) {
      dispatch({ type: 'setError', error: result.message });
      return;
    }
    commitMatch(result);
    dispatch({ type: 'navigate', screen: 'table' });
    void feel('deal');
  };

  const changeSettings = (partial: Partial<AppSettings>) => {
    dispatch({ type: 'setSettings', settings: partial });
    void saveSettings({ ...session.settings, ...partial });
  };

  const language = session.settings.language;
  const youReadyForNext = nextHandReady.includes(localSeat);
  const youReadyToPlayAgain = playAgainReady.includes(localSeat);
  const waitingForNextHand = useMemo(() => {
    if (!view || view.phase !== 'handComplete' || !youReadyForNext) {
      return null;
    }
    const names = waitingSeatNames(onlineRoom?.seats, nextHandReady);
    return names.length > 0 ? t(language, 'waitingNextHand', { names: names.join(', ') }) : t(language, 'youAreReady');
  }, [view, youReadyForNext, onlineRoom, nextHandReady, language]);
  const waitingForPlayAgain = useMemo(() => {
    if (!view || view.phase !== 'matchComplete' || !youReadyToPlayAgain) {
      return null;
    }
    const names = waitingSeatNames(onlineRoom?.seats, playAgainReady);
    return names.length > 0 ? t(language, 'waitingPlayAgain', { names: names.join(', ') }) : t(language, 'youAreReady');
  }, [view, youReadyToPlayAgain, onlineRoom, playAgainReady, language]);
  const rules = session.match?.rules ?? DEFAULT_RULES;
  const onMicStatus = useCallback((status: MicCaptureStatus) => {
    setMicStatus(status);
    if (status === 'live') {
      sendVoiceStatus(true);
      return;
    }
    if (status === 'unavailable' || status === 'denied' || status === 'interrupted') {
      sendVoiceStatus(false);
    }
  }, []);
  const tableSeats = useMemo(() => {
    if (!onlineRoom) {
      return null;
    }
    return onlineRoom.seats.map((seat, index) => {
      if (index !== localSeat) {
        return seat;
      }
      const connection =
        netStatus === 'reconnecting' || netStatus === 'restoring' ? netStatus : seat.connection;
      const voiceAvailable =
        micStatus === 'denied' || micStatus === 'unavailable' || micStatus === 'interrupted'
          ? false
          : seat.voiceAvailable;
      return { ...seat, connection, voiceAvailable };
    });
  }, [onlineRoom, localSeat, netStatus, micStatus]);

  const toggleMute = useCallback(() => {
    const occupant = onlineRoom?.seats[localSeat];
    if (!occupant || occupant.isBot) {
      return;
    }
    void (async () => {
      if (occupant.muted) {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setMicStatus('denied');
          sendVoiceStatus(false);
          Alert.alert(t(language, 'voice'), t(language, 'micDenied'));
          return;
        }
      }
      sendMute(!occupant.muted);
    })();
  }, [onlineRoom, localSeat, language]);

  const roomFrom = (result: RoomResult): { game: GameSummary; pending: boolean } => {
    if ('pending' in result) {
      return { game: result.game, pending: Boolean(result.pending) };
    }
    return { game: result, pending: false };
  };

  const enterRoom = async (factory: () => Promise<RoomResult>) => {
    try {
      const { game, pending } = roomFrom(await factory());
      if (pending) {
        setJoinWaiting(game.code);
        dispatch({ type: 'navigate', screen: 'social' });
        return;
      }
      setJoinWaiting(null);
      dispatch({ type: 'navigate', screen: game.status === 'playing' ? 'table' : 'lobby' });
      openGame(game.id, game.status === 'playing');
    } catch (error) {
      setNetError(error instanceof Error ? error.message : 'relayDown');
    }
  };

  const startFreshRoom = async (factory: () => Promise<RoomResult>) => {
    if (onlineRoom?.id) {
      void leaveGame(onlineRoom.id).catch(() => undefined);
    }
    sendLeave();
    detachFromTable();
    setJoinWaiting(null);
    await enterRoom(factory);
  };

  useEffect(() => {
    startFreshRef.current = startFreshRoom;
  });

  useEffect(() => {
    const take = (url: string | null) => {
      const code = joinCodeFromLink(url);
      if (code) {
        setLinkCode(code);
      }
      if (adminFlagFromLink(url)) {
        setAdminOpen(true);
      }
    };
    const sub = Linking.addEventListener('url', (event) => take(event.url));
    void Linking.getInitialURL().then(take);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!linkCode || !me) {
      return;
    }
    const code = linkCode;
    setLinkCode(null);
    setNetError(null);
    clearJoinFromAddressBar();
    void connectNet().then(() => startFreshRoom(() => joinGame(code)));
  }, [linkCode, me]);

  useEffect(() => subscribeFullscreen(() => setFullScreenOn(isFullscreen())), []);

  const showFullscreen = fullscreenAvailable();
  const fullscreenLabel = showFullscreen
    ? t(language, fullScreenOn && fullscreenKind() !== 'home-screen' ? 'exitFullScreen' : 'fullScreen')
    : null;
  const goFullscreen = () => {
    void (async () => {
      const result = await toggleFullscreen();
      setFullScreenOn(isFullscreen());
      if (result === 'home-screen') {
        Alert.alert(t(language, 'addToHomeTitle'), t(language, 'addToHomeBody'));
        return;
      }
      if (result === 'unavailable') {
        Alert.alert(t(language, 'fullScreen'), t(language, 'fullscreenUnavailable'));
      }
    })();
  };

  return (
    <View style={styles.shell}>
      {session.screen === 'table' && view ? (
        <TableScreen
          language={language}
          view={view}
          selectedIds={session.selectedIds}
          lastError={session.lastError ?? selectionError}
          showLegalMoves={session.settings.showLegalMoves}
          legalCardIds={legalCardIds}
          legalMoveCount={legalMoves.length}
          selectionLegal={selectionLegal}
          humanTurn={
            view.currentSeat === localSeat && (view.phase === 'playing' || view.phase === 'exchanging')
          }
          turnDurationMs={
            session.match
              ? durationForCurrentTurn(session.match, botSeats, localSeat, online)
              : motion.humanTurnMs
          }
          localSeat={localSeat}
          roomSeats={tableSeats}
          chat={online ? chat : []}
          onSendChat={online ? sendChat : undefined}
          onToggleMute={toggleMute}
          humanAppearance={{
            profileUri: session.settings.profileUri,
            tone: 0,
          }}
          onToggleCard={(cardId) => {
            void feel('select');
            dispatch({ type: 'toggleCard', cardId });
          }}
          onPlay={playSelected}
          onPass={passTurn}
          onMenu={leaveTable}
          onSettings={() => {
            settingsFromTable.current = true;
            dispatch({ type: 'navigate', screen: 'settings' });
          }}
          handSize={session.settings.handSize}
          onHandSize={(size) => changeSettings({ handSize: size })}
          fullscreenLabel={fullscreenLabel}
          fullscreenActive={fullScreenOn && fullscreenKind() !== 'home-screen'}
          onFullscreen={showFullscreen ? goFullscreen : undefined}
          chaos={chaosView}
          reactions={reactions}
          reactionCoolUntil={online ? reactionCoolUntil : 0}
          onSendReaction={online ? sendReaction : undefined}
          onActivateAbility={
            online
              ? (payload) => sendIntent('ability', payload)
              : undefined
          }
        />
      ) : (
        <SafeAreaView style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
          {session.screen === 'home' ? (
            <HomeScreen
              language={language}
              canResume={canResume}
              onOnline={() => {
                setNetError(null);
                dispatch({ type: 'navigate', screen: 'social' });
                void connectNet();
              }}
              onResume={resume}
              onRules={() => dispatch({ type: 'navigate', screen: 'rules' })}
              onSettings={() => {
                settingsFromTable.current = false;
                dispatch({ type: 'navigate', screen: 'settings' });
              }}
              onTerms={() => setLegalOpen('terms')}
              onPrivacy={() => setLegalOpen('privacy')}
            />
          ) : null}
          {session.screen === 'social' ? (
            <SocialHubScreen
              language={language}
              status={netStatus}
              error={netError}
              me={me}
              friends={friends}
              requests={requests}
              inbox={inbox}
              games={games}
              onBack={goHome}
              onProfile={() => {
                if (me) {
                  void fetchProfile(me.id).then((profile) => {
                    setProfileHistory(profile?.history ?? []);
                    setProfileFriends(profile?.friends ?? friends);
                  });
                }
                dispatch({ type: 'navigate', screen: 'profile' });
              }}
              waitingJoin={joinWaiting}
              onCreate={() => void startFreshRoom(() => createGame())}
              onJoin={(code) => void startFreshRoom(() => joinGame(code))}
              onOpenGame={(game) => {
                if (game.joinPending) {
                  setJoinWaiting(game.code);
                  return;
                }
                if (game.invited && !game.seats.some((seat) => seat.isYou)) {
                  if (game.status === 'playing') {
                    setInvitePrompt({
                      kind: 'mid',
                      name: game.seats.find((seat) => seat.userId === game.createdBy)?.name ?? 'Player',
                      gameId: game.id,
                      code: game.code,
                    });
                    return;
                  }
                  void startFreshRoom(() => joinGame(game.code));
                  return;
                }
                dispatch({ type: 'navigate', screen: game.status === 'playing' ? 'table' : 'lobby' });
                openGame(game.id, game.status === 'playing');
              }}
              onRespond={(id, accept) => {
                void respondFriend(id, accept);
              }}
              onJoinFriend={(gameId) => void startFreshRoom(() => joinGameById(gameId))}
              onFriendMidGame={(name) => setInvitePrompt({ kind: 'mid', name, gameId: '', code: '' })}
            />
          ) : null}
          {session.screen === 'profile' ? (
            <ProfileScreen
              language={language}
              player={me}
              history={profileHistory}
              friends={profileFriends}
              onBack={() => dispatch({ type: 'navigate', screen: 'social' })}
            />
          ) : null}
          {session.screen === 'lobby' ? (
            <LobbyScreen
              language={language}
              room={
                onlineRoom && tableSeats
                  ? { ...onlineRoom, seats: tableSeats }
                  : onlineRoom
              }
              status={netStatus}
              error={netError}
              friends={friends}
              onBack={leaveOnline}
              onHost={() => void startFreshRoom(() => createGame())}
              onJoin={(code) => void startFreshRoom(() => joinGame(code))}
              onRespondJoin={(fromId, accept) => {
                if (onlineRoom?.id) {
                  void respondJoin(onlineRoom.id, fromId, accept).catch((error: unknown) =>
                    Alert.alert(t(language, 'joinRoom'), tError(language, error)),
                  );
                }
              }}
              onFillBots={() => {
                if (onlineRoom?.id) {
                  void fillGameBots(onlineRoom.id);
                }
              }}
              onSetMode={(mode) => {
                if (!onlineRoom?.id || mode === 'chaos') {
                  return;
                }
                setOnlineRoom({
                  ...onlineRoom,
                  mode,
                  seats: seatsForMode(mode, onlineRoom.seats),
                });
                void setGameMode(onlineRoom.id, mode)
                  .then((game) => {
                    setOnlineRoom((current) =>
                      current && current.id === game.id
                        ? { ...current, mode: game.mode, seats: seatsForMode(game.mode, current.seats) }
                        : current,
                    );
                  })
                  .catch((error: unknown) => {
                    Alert.alert(t(language, 'mode'), tError(language, error));
                  });
              }}
              onStart={() => {
                if (onlineRoom?.id) {
                  void startGame(onlineRoom.id, onlineRoom.mode).catch((error: unknown) =>
                    Alert.alert(t(language, 'start'), tError(language, error)),
                  );
                }
              }}
              onReady={(ready) => {
                if (!onlineRoom?.id) {
                  return;
                }
                setOnlineRoom({
                  ...onlineRoom,
                  seats: onlineRoom.seats.map((seat) =>
                    seat.isYou ? { ...seat, lobbyReady: ready } : seat,
                  ),
                });
                void setLobbyReady(onlineRoom.id, ready).catch((error: unknown) => {
                  setOnlineRoom((current) =>
                    current
                      ? {
                          ...current,
                          seats: current.seats.map((seat) =>
                            seat.isYou ? { ...seat, lobbyReady: !ready } : seat,
                          ),
                        }
                      : current,
                  );
                  Alert.alert(t(language, 'ready'), tError(language, error));
                });
              }}
              onLeave={leaveOnline}
              onInvite={(username, team) => {
                if (onlineRoom?.id) {
                  void inviteToGame(onlineRoom.id, username, team).catch((error: unknown) =>
                    Alert.alert(t(language, 'inviteFriend'), tError(language, error)),
                  );
                }
              }}
              onClaimSeat={(seat) => {
                if (onlineRoom?.id) {
                  void claimSeat(onlineRoom.id, seat).catch((error: unknown) =>
                    Alert.alert(t(language, 'room'), tError(language, error)),
                  );
                }
              }}
              onAddFriend={(username) => {
                void requestFriend(username).catch((error: unknown) =>
                  Alert.alert(t(language, 'friends'), tError(language, error)),
                );
              }}
              onShare={() => {
                if (!onlineRoom) {
                  return;
                }
                void shareRoomLink(
                  onlineRoom.code,
                  t(language, 'shareRoomMessage', { code: onlineRoom.code }),
                )
                  .then((result) => {
                    if (result === 'copied') {
                      Alert.alert(t(language, 'shareRoom'), t(language, 'linkCopied'));
                    }
                  })
                  .catch(() => undefined);
              }}
              chat={chat}
              onSendChat={sendChat}
              onToggleMute={toggleMute}
            />
          ) : null}
          {session.screen === 'setup' ? (
            <SetupScreen
              language={language}
              onBack={goHome}
              onStart={beginMatch}
            />
          ) : null}
          {session.screen === 'handResult' && view ? (
            <HandResultScreen
              language={language}
              view={view}
              localSeat={localSeat}
              names={onlineRoom?.seats.map((seat) => (seat.isYou ? t(language, 'you') : seat.name))}
              humanAppearance={{
                profileUri: session.settings.profileUri,
                tone: 0,
              }}
              onNextHand={dealNext}
              nextHandReady={youReadyForNext}
              waitingFor={view.phase === 'matchComplete' ? waitingForPlayAgain : waitingForNextHand}
              roomSeats={tableSeats}
              onToggleMute={toggleMute}
              specialVictorySeat={chaosView?.specialVictorySeat ?? null}
              chaosActive={Boolean(chaosView)}
              chaosAbilityId={chaosView?.own?.abilityId ?? null}
              playAgainReady={youReadyToPlayAgain}
              series={series}
              onMenu={leaveTable}
              onPlayAgain={() => {
                if (online) {
                  if (!youReadyToPlayAgain) {
                    setPlayAgainReady((prev) => [...prev, localSeat]);
                    sendIntent('playAgain');
                  }
                  return;
                }
                const match = startMatch();
                setPlayAgainReady([]);
                seriesTalliedRef.current = false;
                commitMatch(match);
                dispatch({ type: 'navigate', screen: 'table' });
                void feel('deal');
              }}
            />
          ) : null}
          {session.screen === 'rules' ? (
            <RulesScreen
              language={language}
              rules={rules}
              onBack={goHome}
            />
          ) : null}
          {session.screen === 'settings' ? (
            <SettingsScreen
              settings={session.settings}
              player={me}
              onChange={changeSettings}
              onTerms={() => setLegalOpen('terms')}
              onPrivacy={() => setLegalOpen('privacy')}
              onRename={(username) => {
                const next = normalizeUsername(username);
                if (me && next === me.username) {
                  return;
                }
                if (!isUsername(next)) {
                  Alert.alert(t(language, 'username'), t(language, 'badUsername'));
                  return;
                }
                void patchMe({ username: next })
                  .then((result) => setMe(result.player))
                  .catch((error: unknown) => Alert.alert(t(language, 'username'), tError(language, error)));
              }}
              onBack={() => {
                if (settingsFromTable.current && session.match && session.match.phase !== 'matchComplete') {
                  settingsFromTable.current = false;
                  dispatch({
                    type: 'navigate',
                    screen:
                      session.match.phase === 'playing' || session.match.phase === 'exchanging'
                        ? 'table'
                        : 'handResult',
                  });
                  return;
                }
                settingsFromTable.current = false;
                goHome();
              }}
            />
          ) : null}
        </SafeAreaView>
      )}

      <VoiceChannel
        enabled={micOpen}
        mode={session.settings.voiceMode}
        onPacket={(frame) => sendVoice(frame)}
        onSpeaking={sendSpeaking}
        onStatus={onMicStatus}
      />
      {showFullscreen && fullscreenLabel && session.screen !== 'table' ? (
        <FullscreenMark
          label={fullscreenLabel}
          active={fullScreenOn && fullscreenKind() !== 'home-screen'}
          onPress={goFullscreen}
        />
      ) : null}
      {legalVersion !== null && legalVersion < TERMS_VERSION && !legalOpen ? (
        <TermsGate
          language={language}
          onLanguage={(next) => changeSettings({ language: next })}
          onAccept={() => {
            setLegalVersion(TERMS_VERSION);
            void saveLegalVersion(TERMS_VERSION);
          }}
          onOpenTerms={() => setLegalOpen('terms')}
          onOpenPrivacy={() => setLegalOpen('privacy')}
        />
      ) : null}
      <UsernamePrompt
        visible={Boolean(usernamePrompt) && (legalVersion === null || legalVersion >= TERMS_VERSION) && !legalOpen}
        kind={usernamePrompt ?? 'first'}
        language={language}
        currentName={me?.username ?? ''}
        error={usernameError}
        saving={usernameSaving}
        onSkip={() => {
          if (usernamePrompt === 'change') {
            const next = { seenFirst: true, nudgeDismissed: true };
            usernameFlagsRef.current = next;
            void saveUsernamePrompt(next);
          }
          setUsernameError(null);
          setUsernamePrompt(null);
        }}
        onSave={(username) => {
          if (!isUsername(username)) {
            setUsernameError(t(language, 'badUsername'));
            return;
          }
          if (me && username === me.username) {
            const next = { seenFirst: true, nudgeDismissed: true };
            usernameFlagsRef.current = next;
            void saveUsernamePrompt(next);
            setUsernameError(null);
            setUsernamePrompt(null);
            return;
          }
          setUsernameSaving(true);
          void patchMe({ username })
            .then((result) => {
              setMe(result.player);
              const next = { seenFirst: true, nudgeDismissed: true };
              usernameFlagsRef.current = next;
              void saveUsernamePrompt(next);
              setUsernameError(null);
              setUsernamePrompt(null);
            })
            .catch((error: unknown) => setUsernameError(tError(language, error)))
            .finally(() => setUsernameSaving(false));
        }}
      />
      <ConfirmDialog
        visible={Boolean(endedPrompt)}
        overlayDismisses
        title={t(language, 'gameEndedTitle')}
        body={t(language, 'gameEndedBody', { code: endedPrompt?.code || '—' })}
        confirmLabel={t(language, 'ok')}
        onCancel={() => setEndedPrompt(null)}
        onConfirm={() => setEndedPrompt(null)}
      />
      <ConfirmDialog
        visible={Boolean(invitePrompt) && !endedPrompt}
        overlayDismisses={
          invitePrompt?.kind !== 'admit' && invitePrompt?.kind !== 'switch' && invitePrompt?.kind !== 'friend'
        }
        title={
          invitePrompt?.kind === 'join'
            ? t(language, 'joinTheRoom')
            : invitePrompt?.kind === 'admit'
              ? t(language, 'joinRequests')
              : invitePrompt?.kind === 'switch'
                ? t(language, 'switchSeats')
                : invitePrompt?.kind === 'friend'
                  ? t(language, 'friendRequests')
                  : t(language, 'playingNow')
        }
        body={
          invitePrompt?.kind === 'join'
            ? t(language, 'inviteJoinBody', {
                name: invitePrompt.name,
                code: invitePrompt.code || '—',
              })
            : invitePrompt?.kind === 'admit'
              ? t(language, 'wantsToJoin', {
                  name: invitePrompt.name,
                  code: invitePrompt.code || '—',
                })
              : invitePrompt?.kind === 'switch'
                ? t(language, 'wantsToSwitch', { name: invitePrompt.name })
                : invitePrompt?.kind === 'friend'
                  ? t(language, 'friendRequestBody', { name: invitePrompt.name })
                  : t(language, 'friendMidGame', { name: invitePrompt?.name ?? '' })
        }
        confirmLabel={
          invitePrompt?.kind === 'join'
            ? t(language, 'joinTheRoom')
            : invitePrompt?.kind === 'admit'
              ? t(language, 'allowJoin')
              : invitePrompt?.kind === 'switch' || invitePrompt?.kind === 'friend'
                ? t(language, 'accept')
                : t(language, 'ok')
        }
        cancelLabel={
          invitePrompt?.kind === 'join'
            ? t(language, 'notNow')
            : invitePrompt?.kind === 'admit' || invitePrompt?.kind === 'switch'
              ? t(language, 'denyJoin')
              : invitePrompt?.kind === 'friend'
                ? t(language, 'reject')
                : undefined
        }
        onCancel={() => {
          const prompt = invitePrompt;
          setInvitePrompt(null);
          if (prompt?.kind === 'admit' && prompt.gameId && prompt.fromId) {
            void respondJoin(prompt.gameId, prompt.fromId, false).catch(() => undefined);
          }
          if (prompt?.kind === 'switch' && prompt.gameId && prompt.fromId) {
            void respondSwitch(prompt.gameId, prompt.fromId, false).catch(() => undefined);
          }
          if (prompt?.kind === 'friend' && prompt.requestId) {
            void respondFriend(prompt.requestId, false).catch(() => undefined);
          }
        }}
        onConfirm={() => {
          const prompt = invitePrompt;
          setInvitePrompt(null);
          if (!prompt) {
            return;
          }
          if (prompt.kind === 'admit' && prompt.fromId) {
            void respondJoin(prompt.gameId, prompt.fromId, true).catch((error: unknown) =>
              Alert.alert(t(language, 'joinRoom'), tError(language, error)),
            );
            return;
          }
          if (prompt.kind === 'switch' && prompt.fromId) {
            void respondSwitch(prompt.gameId, prompt.fromId, true).catch((error: unknown) =>
              Alert.alert(t(language, 'switchSeats'), tError(language, error)),
            );
            return;
          }
          if (prompt.kind === 'friend' && prompt.requestId) {
            void respondFriend(prompt.requestId, true).catch((error: unknown) =>
              Alert.alert(t(language, 'friends'), tError(language, error)),
            );
            return;
          }
          if (prompt.kind !== 'join') {
            return;
          }
          void startFreshRoom(() => (prompt.code ? joinGame(prompt.code) : joinGameById(prompt.gameId)));
        }}
      />
      <ConfirmDialog
        visible={session.confirmNewGame}
        title={t(language, 'confirmNewTitle')}
        body={t(language, 'confirmNewBody')}
        confirmLabel={t(language, 'confirm')}
        cancelLabel={t(language, 'cancel')}
        onCancel={() => dispatch({ type: 'askConfirmNewGame', value: false })}
        onConfirm={() => {
          sendLeave();
          detachFromTable();
          dispatch({ type: 'navigate', screen: 'setup' });
        }}
      />
      {adminOpen ? (
        <SafeAreaView style={styles.adminOverlay} edges={['top', 'right', 'bottom', 'left']}>
          <AdminScreen
            language={language}
            onBack={() => {
              setAdminOpen(false);
              clearAdminFromAddressBar();
            }}
          />
        </SafeAreaView>
      ) : null}
      {legalOpen ? (
        <SafeAreaView style={styles.legalOverlay} edges={['top', 'right', 'bottom', 'left']}>
          <LegalScreen
            language={language}
            kind={legalOpen}
            onSwitch={setLegalOpen}
            onBack={() => setLegalOpen(null)}
          />
        </SafeAreaView>
      ) : null}
      <RotateHint language={language} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.room,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.room,
  },
  adminOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.room,
    zIndex: 30,
  },
  legalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.room,
    zIndex: 70,
  },
});
