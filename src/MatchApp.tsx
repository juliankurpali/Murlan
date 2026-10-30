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
  Card,
  GameState,
  DEFAULT_RULES,
  explainExchangeSelection,
  explainSelection,
  isRuleError,
  legalMovesForSeat,
  mathRandomSource,
  SeatId,
  toPublicView,
} from './domain';
import { ConfirmDialog } from './components/ConfirmDialog';
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
import { botSeatsOf, GameRoom, localSeatOf } from './online/room';
import * as Linking from 'expo-linking';
import { t, tError } from './i18n';
import { isUsername, normalizeUsername } from './platform/ids';
import { Friendship, GameSummary, JoinOutcome, MatchHistoryRow, PlatformNotice, PublicPlayer } from './platform/types';
import { matchFromView } from './platform/viewMatch';
import { AdminScreen } from './screens/AdminScreen';
import { HandResultScreen } from './screens/HandResultScreen';
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
  loadPlayerKey,
  loadSettings,
  loadTableSession,
  saveAuth,
  saveSettings,
  saveTableSession,
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
  setLobbyReady,
  inviteToGame,
} from './social/api';
import { colors, motion } from './theme';
import {
  fullscreenAvailable,
  fullscreenKind,
  isFullscreen,
  subscribeFullscreen,
  toggleFullscreen,
} from './webFullscreen';

type InvitePrompt = {
  kind: 'join' | 'mid' | 'admit' | 'switch';
  name: string;
  gameId: string;
  code: string;
  fromId?: string;
};

type RoomResult = GameSummary | JoinOutcome;

export function MatchApp() {
  const [session, dispatch] = useReducer(sessionReducer, initialSession());
  const [onlineRoom, setOnlineRoom] = useState<GameRoom | null>(null);
  const [netStatus, setNetStatus] = useState<NetStatus>('idle');
  const [netError, setNetError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [nextHandReady, setNextHandReady] = useState<SeatId[]>([]);
  const [micStatus, setMicStatus] = useState<MicCaptureStatus>('muted');
  const [me, setMe] = useState<PublicPlayer | null>(null);
  const [friends, setFriends] = useState<PublicPlayer[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [inbox, setInbox] = useState<PlatformNotice[]>([]);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [profileHistory, setProfileHistory] = useState<MatchHistoryRow[]>([]);
  const [profileFriends, setProfileFriends] = useState<PublicPlayer[]>([]);
  const [invitePrompt, setInvitePrompt] = useState<InvitePrompt | null>(null);
  const [joinWaiting, setJoinWaiting] = useState<string | null>(null);
  const screenRef = useRef(session.screen);
  const restoreRef = useRef(false);
  const settingsFromTable = useRef(false);
  const seenNoticeIds = useRef(new Set<string>());
  const noticesReady = useRef(false);
  const tableGameIdRef = useRef<string | null>(null);
  const startFreshRef = useRef<(factory: () => Promise<RoomResult>) => Promise<void>>(async () => undefined);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [fullScreenOn, setFullScreenOn] = useState(isFullscreen);
  const localSeat = localSeatOf(onlineRoom) as SeatId;
  const botSeats = botSeatsOf(onlineRoom);
  const online = Boolean(onlineRoom);
  const canResume = online && matchIsUnfinished(session.match);
  const commitMatch = useCallback((match: GameState) => {
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
    setNextHandReady([]);
    setMicStatus('muted');
    void clearMatch();
    dispatch({ type: 'setMatch', match: null });
  }, []);

  useEffect(() => {
    void (async () => {
      const [settings, identity, auth, tableSession] = await Promise.all([
        loadSettings(),
        loadPlayerKey(),
        loadAuth(),
        loadTableSession(),
      ]);
      dispatch({ type: 'hydrate', match: null, settings });
      await clearMatch();
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
      onEnded: (gameId) => {
        if (tableGameIdRef.current === gameId) {
          detachFromTable();
        }
      },
      onView: (table) => {
        setNextHandReady(table.nextHandReady ?? []);
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
          if (table.view.phase === 'matchComplete') {
            detachFromTable();
          }
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
      onVoice: (seat, pcm, rate) => playSeatVoice(seat, pcm, rate),
      onChat: (message) => setChat((prev) => [...prev, message].slice(-40)),
      onChatHistory: setChat,
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
      const game = gameOf(item);
      if (item.read || !game || game.status !== 'lobby') {
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
        if (actionable(item)) {
          continue;
        }
        seen.add(item.id);
        if (!item.read && (item.kind === 'invite' || item.kind === 'join-request' || item.kind === 'seat-switch')) {
          handled.push(item.id);
        }
      }
    }
    const busy =
      session.screen === 'table' || session.screen === 'handResult' || session.screen === 'lobby';
    const labelFor = (item: PlatformNotice) =>
      friends.find((row) => row.id === item.fromId)?.username ??
      gameOf(item)?.seats.find((seat) => seat.userId === item.fromId)?.name ??
      'Player';
    const order = (item: PlatformNotice) =>
      item.kind === 'join-request' ? 0 : item.kind === 'seat-switch' ? 1 : item.kind === 'invite' ? 2 : 3;
    const incoming = inbox.filter((item) => !seen.has(item.id)).sort((a, b) => order(a) - order(b));
    try {
      for (const item of incoming) {
        if (item.read) {
          seen.add(item.id);
          continue;
        }
        if (item.kind === 'join-request' || item.kind === 'seat-switch' || item.kind === 'invite') {
          if (!actionable(item) || !item.gameId || !item.fromId) {
            done(item);
            continue;
          }
          if (invitePrompt || (item.kind === 'invite' && busy)) {
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
  }, [inbox, games, friends, me, session.screen, session.settings.language, invitePrompt]);

  useEffect(() => {
    configureFeel({
      sound: session.settings.sound,
      music: session.settings.music,
      haptics: session.settings.haptics,
    });
    setVoicePlaybackMode(session.settings.voiceMode);
  }, [session.settings.sound, session.settings.music, session.settings.haptics, session.settings.voiceMode]);

  const micOpen = Boolean(
    online && session.screen === 'table' && !(onlineRoom?.seats[localSeat]?.muted ?? true),
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
  const [turnProgress, setTurnProgress] = useState(0);

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
    const action = !online && botTurn ? peekBotAction(match, localSeat, botSeats) : null;
    const dealDelay = match.history.length === 0 ? motion.dealMs : 0;
    const duration = botTurn
      ? action?.type === 'pass'
        ? motion.botPassMs
        : motion.botPlayMs
      : motion.humanTurnMs;
    setTurnProgress(0);
    let tick: ReturnType<typeof setInterval> | undefined;
    let turnHandle: ReturnType<typeof setTimeout> | undefined;
    const startTurn = () => {
      const started = Date.now();
      tick = setInterval(() => {
        setTurnProgress(Math.min(1, (Date.now() - started) / duration));
      }, 80);
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
      if (tick) {
        clearInterval(tick);
      }
    };
  }, [turnKey, commitMatch, online, botSeats, localSeat]);

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

  const beginMatch = (mode: Parameters<typeof startMatch>[0], language: AppSettings['language']) => {
    const match = startMatch(mode);
    dispatch({ type: 'setSettings', settings: { language } });
    void saveSettings({ ...session.settings, language });
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
  const waitingForNextHand = useMemo(() => {
    if (!view || view.phase !== 'handComplete' || !youReadyForNext) {
      return null;
    }
    const names = (onlineRoom?.seats ?? [])
      .map((seat, index) => ({ seat, index }))
      .filter(
        ({ seat, index }) =>
          seat.ready && !seat.isBot && !seat.isYou && !nextHandReady.includes(index as SeatId),
      )
      .map(({ seat }) => seat.name);
    return names.length > 0 ? t(language, 'waitingNextHand', { names: names.join(', ') }) : t(language, 'youAreReady');
  }, [view, youReadyForNext, onlineRoom, nextHandReady, language]);
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
          turnProgress={turnProgress}
          localSeat={localSeat}
          roomSeats={tableSeats}
          chat={online ? chat : []}
          onSendChat={online ? sendChat : undefined}
          onToggleMute={() => {
            const occupant = onlineRoom?.seats[localSeat];
            if (!occupant) {
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
          }}
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
          fullscreenLabel={fullscreenLabel}
          onFullscreen={showFullscreen ? goFullscreen : undefined}
        />
      ) : (
        <SafeAreaView style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
          {session.screen === 'home' ? (
            <HomeScreen
              language={language}
              canResume={canResume}
              fullscreenLabel={fullscreenLabel}
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
              onFullscreen={showFullscreen ? goFullscreen : undefined}
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
              onCreate={(mode) => void startFreshRoom(() => createGame(mode))}
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
              room={onlineRoom}
              status={netStatus}
              error={netError}
              friends={friends}
              onBack={leaveOnline}
              onHost={() => void startFreshRoom(() => createGame('2v2'))}
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
              onStart={() => {
                if (onlineRoom?.id) {
                  void startGame(onlineRoom.id).catch((error: unknown) =>
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
              waitingFor={waitingForNextHand}
              onMenu={leaveTable}
              onPlayAgain={() => {
                if (online) {
                  leaveTable();
                  return;
                }
                dispatch({ type: 'navigate', screen: 'setup' });
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
        onFrame={(pcm, rate) => sendVoice(pcm, rate)}
        onSpeaking={sendSpeaking}
        onStatus={onMicStatus}
      />
      <ConfirmDialog
        visible={Boolean(invitePrompt)}
        overlayDismisses={invitePrompt?.kind !== 'admit' && invitePrompt?.kind !== 'switch'}
        title={
          invitePrompt?.kind === 'join'
            ? t(language, 'joinTheRoom')
            : invitePrompt?.kind === 'admit'
              ? t(language, 'joinRequests')
              : invitePrompt?.kind === 'switch'
                ? t(language, 'switchSeats')
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
                : t(language, 'friendMidGame', { name: invitePrompt?.name ?? '' })
        }
        confirmLabel={
          invitePrompt?.kind === 'join'
            ? t(language, 'joinTheRoom')
            : invitePrompt?.kind === 'admit'
              ? t(language, 'allowJoin')
              : invitePrompt?.kind === 'switch'
                ? t(language, 'accept')
                : t(language, 'ok')
        }
        cancelLabel={
          invitePrompt?.kind === 'join'
            ? t(language, 'notNow')
            : invitePrompt?.kind === 'admit' || invitePrompt?.kind === 'switch'
              ? t(language, 'denyJoin')
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
});
