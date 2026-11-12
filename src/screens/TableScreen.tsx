import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStageDimensions } from '../components/WebStage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SeatAppearance, appearanceForSeat } from '../application/players';
import { clampHandSize, DEFAULT_HAND_SIZE, Language } from '../application/types';
import {
  ChaosAbilityId,
  Card,
  currentTrickPlays,
  formatCardShort,
  lastPlayedSeatFromHistory,
  placeForSeat,
  PublicChaosView,
  PublicMatchView,
  SeatId,
} from '../domain';
import { ChatMessage } from '../online/chat';
import { RoomSeat, tableSeat } from '../online/room';
import { baseBotName } from '../platform/ids';
import { ReactionEvent, ReactionId } from '../reactions';
import { AbilityMark, ABILITY_GLYPH } from '../components/AbilityMark';
import { ActionOrb } from '../components/ActionOrb';
import { ChaosBook } from '../components/ChaosBook';
import { SuperBook } from '../components/SuperBook';
import { ChaosFx } from '../components/ChaosFx';
import { CHAOS_ABILITY_NAME } from '../components/chaosAbilities';
import { CardFace } from '../components/CardFace';
import { ChatPanel } from '../components/ChatPanel';
import { DealFlight } from '../components/DealFlight';
import { ExchangeReveal } from '../components/ExchangeReveal';
import { FeltCloth } from '../components/FeltCloth';
import { HandStrip } from '../components/HandStrip';
import { PassBurst } from '../components/PassBurst';
import { PlayFlight } from '../components/PlayFlight';
import { ReactionOverlay } from '../components/ReactionOverlay';
import { ReactionTray } from '../components/ReactionTray';
import { ScoreChips } from '../components/ScoreChips';
import { OvalSeat, SeatRack } from '../components/SeatRack';
import { TableChatFeed } from '../components/TableChatFeed';
import { TableSize, fitHandCards, handCardMax, handSideInset, isPhoneViewport, scaledHandCard, seatAngle, seatPoint } from '../components/tableLayout';
import { TrickPile } from '../components/TrickPile';
import { UiButton } from '../components/UiButton';
import { MessageKey, seatName, t } from '../i18n';
import { LayoutGroup } from '../motion';
import { colors, motion, spacing, teamToken } from '../theme';

type Props = {
  language: Language;
  view: PublicMatchView;
  selectedIds: string[];
  lastError: string | null;
  showLegalMoves: boolean;
  legalCardIds: Set<string>;
  legalMoveCount: number;
  selectionLegal: boolean | null;
  humanTurn: boolean;
  turnDurationMs?: number;
  humanAppearance: SeatAppearance;
  localSeat?: SeatId;
  roomSeats?: RoomSeat[] | null;
  chat?: ChatMessage[];
  onSendChat?: (text: string) => void;
  onToggleMute?: () => void;
  onToggleCard: (cardId: string) => void;
  onPlay: () => void;
  onPass: () => void;
  onMenu: () => void;
  onSettings: () => void;
  fullscreenLabel?: string | null;
  fullscreenActive?: boolean;
  onFullscreen?: () => void;
  handSize?: number;
  onHandSize?: (size: number) => void;
  chaos?: PublicChaosView | null;
  reactions?: ReactionEvent[];
  reactionCoolUntil?: number;
  onSendReaction?: (reactionId: ReactionId, targetPlayerId: string) => void;
  onActivateAbility?: (payload: {
    abilityId: ChaosAbilityId;
    targetSeat?: SeatId;
    cardId?: string;
    intoCardId?: string;
  }) => void;
};

function playSignature(view: PublicMatchView): { key: string; seat: SeatId; cards: Card[] } | null {
  for (let index = view.history.length - 1; index >= 0; index -= 1) {
    const event = view.history[index];
    if (event?.kind === 'play') {
      return {
        key: `${view.handIndex}-${event.seat}-${event.combination.cards.map((card) => card.id).join(',')}`,
        seat: event.seat,
        cards: event.combination.cards,
      };
    }
  }
  return null;
}

export function TableScreen({
  language,
  view,
  selectedIds,
  lastError,
  showLegalMoves,
  legalCardIds,
  selectionLegal,
  humanTurn,
  turnDurationMs,
  humanAppearance,
  localSeat = 0,
  roomSeats = null,
  chat = [],
  onSendChat,
  onToggleMute,
  reactions = [],
  reactionCoolUntil = 0,
  onSendReaction,
  onToggleCard,
  onPlay,
  onPass,
  onMenu,
  onSettings,
  fullscreenLabel = null,
  fullscreenActive = false,
  onFullscreen,
  handSize = DEFAULT_HAND_SIZE,
  onHandSize,
  chaos = null,
  onActivateAbility,
}: Props) {
  const { width, height } = useStageDimensions();
  const insets = useSafeAreaInsets();
  const phone = isPhoneViewport(width, height);
  const cardMax = scaledHandCard(handCardMax(width, height), handSize);
  const padL = Math.max(insets.left, 8);
  const padR = Math.max(insets.right, 8);
  const padT = Math.max(insets.top, 6);
  const padB = Math.max(insets.bottom, 8);
  const rimX = Math.max(padL, padR);
  const rimY = Math.max(padT, padB);
  const lastPlayedSeat = lastPlayedSeatFromHistory(view.history);
  const lastPlayedName =
    lastPlayedSeat === null
      ? null
      : lastPlayedSeat === localSeat
        ? t(language, 'you')
        : roomSeats?.[lastPlayedSeat]?.name || seatName(language, lastPlayedSeat);
  const play = useMemo(() => playSignature(view), [view]);
  const priorPlays = useMemo(
    () => currentTrickPlays(view.history).slice(0, -1).slice(-2).map((event) => event.combination),
    [view.history],
  );
  const lastEvent = view.history[view.history.length - 1];
  const passBurst =
    lastEvent?.kind === 'pass'
      ? { key: `${view.history.length}-${lastEvent.seat}`, seat: lastEvent.seat }
      : null;

  const [tableSize, setTableSize] = useState<TableSize | null>(null);
  const tableWidth = tableSize?.width ?? width;
  const cornerBtn = phone ? 96 : 108;
  const youBand = phone ? 52 : 60;
  const handInset = Math.max(handSideInset(tableWidth), cornerBtn);
  const handLeft = rimX + handInset;
  const handRight = rimX + handInset;
  const handFit = fitHandCards(view.ownHand.length, tableWidth - handLeft - handRight, cardMax);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeen, setChatSeen] = useState(0);
  const [chatResumeId, setChatResumeId] = useState<string | null>(null);
  const [feed, setFeed] = useState<ChatMessage[]>([]);
  const feedTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const joinedAt = useRef(Date.now());
  const unread = Math.max(0, chat.length - chatSeen);
  const lastChat = chat[chat.length - 1] ?? null;
  const [bookOpen, setBookOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [reactPick, setReactPick] = useState<ReactionId | null>(null);
  const [reactTarget, setReactTarget] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const [chaosPick, setChaosPick] = useState<'idle' | 'target' | 'wildFrom' | 'wildInto'>('idle');
  const [wildFrom, setWildFrom] = useState<string | null>(null);
  const [peekHiddenAt, setPeekHiddenAt] = useState<number | null>(null);
  const [seenNotice, setSeenNotice] = useState<string | null>(null);
  const [landedKey, setLandedKey] = useState(play?.key ?? '');
  const skipFlight = useRef(true);
  const dealKey = `deal-${view.handIndex}`;
  const [dealtKey, setDealtKey] = useState<string | null>(view.history.length > 0 ? dealKey : null);
  const dealing = view.history.length === 0 && dealtKey !== dealKey && view.phase !== 'handComplete' && view.phase !== 'matchComplete';

  useEffect(() => {
    if (view.history.length > 0) {
      setDealtKey(`deal-${view.handIndex}`);
      return;
    }
    setDealtKey((prev) => (prev === `deal-${view.handIndex}` ? prev : null));
  }, [view.handIndex, view.history.length]);

  useEffect(() => {
    if (dealtKey === dealKey || view.history.length > 0 || view.phase === 'handComplete' || view.phase === 'matchComplete') {
      return;
    }
    const handle = setTimeout(() => setDealtKey(dealKey), motion.dealMs + 200);
    return () => clearTimeout(handle);
  }, [dealKey, dealtKey, view.history.length, view.phase]);
  const exchanging = view.phase === 'exchanging';
  const exchangeKey =
    view.lastExchange?.kind === 'swap'
      ? `${view.handIndex}-${view.lastExchange.givenToFirst.id}-${view.lastExchange.returnedToLast.id}`
      : view.lastExchange?.kind === 'skipped'
        ? `${view.handIndex}-skipped`
        : null;
  const [seenExchange, setSeenExchange] = useState<string | null>(null);
  const showExchange = Boolean(
    !dealing && view.lastExchange && exchangeKey && view.history.length === 0 && seenExchange !== exchangeKey,
  );
  const tableName = (seat: SeatId): string => {
    if (seat === localSeat) {
      return t(language, 'you');
    }
    const occupant = roomSeats?.[seat];
    if (occupant?.name) {
      return baseBotName(occupant.name);
    }
    return baseBotName(seatName(language, seat));
  };
  const exchangeCaption =
    view.lastExchange?.kind === 'swap'
      ? t(language, 'exchangeBanner', {
          last: tableName(view.lastExchange.lastSeat),
          first: tableName(view.lastExchange.firstSeat),
          given: formatCardShort(view.lastExchange.givenToFirst),
          returned: formatCardShort(view.lastExchange.returnedToLast),
        })
      : view.lastExchange?.kind === 'skipped'
        ? t(language, 'exchangeSkipped')
        : null;
  const receivedCardId =
    exchanging && view.pendingExchange && view.pendingExchange.firstSeat === localSeat
      ? view.pendingExchange.givenToFirst.id
      : view.lastExchange?.kind === 'swap' && view.history.length === 0
        ? view.lastExchange.firstSeat === localSeat
          ? view.lastExchange.givenToFirst.id
          : view.lastExchange.lastSeat === localSeat
            ? view.lastExchange.returnedToLast.id
            : null
        : null;
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const highlightKey = receivedCardId ? `${view.handIndex}-${receivedCardId}` : '';

  useEffect(() => {
    if (!showExchange || !exchangeKey) {
      return;
    }
    const handle = setTimeout(() => setSeenExchange(exchangeKey), motion.exchangeRevealMs);
    return () => clearTimeout(handle);
  }, [showExchange, exchangeKey]);

  useEffect(() => {
    if (!highlightKey || !receivedCardId) {
      setHighlightIds(new Set());
      return;
    }
    setHighlightIds(new Set([receivedCardId]));
    const handle = setTimeout(() => setHighlightIds(new Set()), motion.exchangeHighlightMs);
    return () => clearTimeout(handle);
  }, [highlightKey, receivedCardId]);

  useEffect(() => {
    const nextKey = play?.key ?? '';
    if (skipFlight.current) {
      skipFlight.current = false;
      setLandedKey(nextKey);
      return;
    }
    if (!nextKey) {
      setLandedKey('');
      return;
    }
    const wait = motion.flightMs + motion.staggerMs * Math.max(play?.cards.length ?? 1, 1) + 160;
    const handle = setTimeout(() => setLandedKey(nextKey), wait);
    return () => clearTimeout(handle);
  }, [play?.key, play?.cards.length]);

  useEffect(() => {
    if (chatOpen) {
      setChatSeen(chat.length);
    }
  }, [chatOpen, chat.length]);

  useEffect(() => {
    if (!lastChat || lastChat.at < joinedAt.current - 400) {
      return;
    }
    const id = lastChat.id;
    setFeed((prev) => [...prev.filter((row) => row.id !== id), lastChat].slice(-3));
    const previous = feedTimers.current.get(id);
    if (previous) {
      clearTimeout(previous);
    }
    feedTimers.current.set(
      id,
      setTimeout(() => {
        setFeed((prev) => prev.filter((row) => row.id !== id));
        feedTimers.current.delete(id);
      }, 6400),
    );
  }, [lastChat]);

  useEffect(
    () => () => {
      feedTimers.current.forEach((timer) => clearTimeout(timer));
      feedTimers.current.clear();
    },
    [],
  );

  const flying = Boolean(play && play.key !== landedKey);
  const revealed = !flying;
  const seatCount = view.cardCounts.length;
  const superTable = view.mode === 'super' || seatCount === 6;
  const youTeam = view.teamOf[localSeat] ?? localSeat % (superTable ? 3 : 2);
  const scoreFor = (team: number) =>
    team === 0 ? view.teamScores.team0 : team === 1 ? view.teamScores.team1 : (view.teamScores.team2 ?? 0);
  const themTeam = youTeam === 1 ? 0 : 1;
  const extraTeam = superTable ? (youTeam === 2 ? 1 : 2) : null;
  const youScore = scoreFor(youTeam);
  const themScore = scoreFor(themTeam);
  const teamKey = (team: number) => (team === 0 ? 'team1' : team === 1 ? 'team2' : 'team3');
  const team1Label = `${t(language, teamKey(youTeam))} · ${t(language, 'you')}`;
  const team2Label = t(language, teamKey(themTeam));
  const extraLabel = extraTeam !== null ? t(language, teamKey(extraTeam)) : '';
  const extraColor = extraTeam !== null ? teamToken(extraTeam) : colors.team3;

  const onTableLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    setTableSize((prev) => {
      if (prev && Math.abs(prev.width - next.width) < 1 && Math.abs(prev.height - next.height) < 1) {
        return prev;
      }
      return { width: next.width, height: next.height };
    });
  };

  const giveTarget = exchanging ? view.pendingExchange?.lastSeat ?? null : null;
  const ownAbility = chaos?.own ?? null;
  const chaosAction = ownAbility && !ownAbility.consumed ? chaosPick : 'idle';
  const peek =
    chaos?.revealedHand && chaos.revealedHand.expiresAt !== peekHiddenAt ? chaos.revealedHand : null;
  const latestNotice = chaos?.notices[chaos.notices.length - 1] ?? null;
  const fxNotice =
    chaos?.notices
      .slice()
      .reverse()
      .find((row) => row.audience === 'all') ?? null;
  const showNotice = Boolean(latestNotice && latestNotice.id !== seenNotice);
  const targeting = chaosAction === 'target';
  const reactEnabled = Boolean(onSendReaction);
  const coolLeft = Math.max(0, Math.ceil((reactionCoolUntil - nowTick) / 1000));
  const pickingReact = reactEnabled && reactPick !== null && coolLeft === 0 && !reactTarget;
  const seatOfPlayer = (playerId: string): SeatId | null => {
    const index = roomSeats?.findIndex((seat) => seat.playerId === playerId) ?? -1;
    return index >= 0 ? (index as SeatId) : null;
  };
  const closeReact = () => {
    setReactOpen(false);
    setReactPick(null);
    setReactTarget(null);
  };
  const sendReactionTo = (playerId: string, reactionId: ReactionId | null) => {
    if (!reactionId || coolLeft > 0) {
      return;
    }
    onSendReaction?.(reactionId, playerId);
    closeReact();
  };
  const canUseAbility =
    Boolean(ownAbility) &&
    ownAbility?.activationType === 'active' &&
    !ownAbility.consumed &&
    ownAbility.remainingUses > 0 &&
    view.phase !== 'matchComplete' &&
    view.phase !== 'handComplete' &&
    (ownAbility.abilityId === 'mindReader' || view.phase === 'playing');

  useEffect(() => {
    setNowTick(Date.now());
    if (reactionCoolUntil <= Date.now()) {
      return;
    }
    const handle = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(handle);
  }, [reactionCoolUntil]);

  useEffect(() => {
    const expiresAt = chaos?.revealedHand?.expiresAt;
    if (!expiresAt) {
      return;
    }
    const wait = Math.max(0, expiresAt - Date.now());
    const handle = setTimeout(() => setPeekHiddenAt(expiresAt), wait);
    return () => clearTimeout(handle);
  }, [chaos?.revealedHand?.expiresAt]);

  useEffect(() => {
    if (!latestNotice || latestNotice.id === seenNotice) {
      return;
    }
    const handle = setTimeout(() => setSeenNotice(latestNotice.id), 3200);
    return () => clearTimeout(handle);
  }, [latestNotice, seenNotice]);

  const activate = (payload: { targetSeat?: SeatId; cardId?: string; intoCardId?: string }) => {
    if (!ownAbility || !onActivateAbility) {
      return;
    }
    onActivateAbility({ abilityId: ownAbility.abilityId, ...payload });
    setChaosPick('idle');
    setWildFrom(null);
  };

  const pressAbility = () => {
    if (!canUseAbility || !ownAbility) {
      return;
    }
    if (chaosPick !== 'idle') {
      setChaosPick('idle');
      setWildFrom(null);
      return;
    }
    closeReact();
    if (ownAbility.targeting === 'opponent') {
      setChaosPick('target');
      return;
    }
    if (ownAbility.abilityId === 'wildCard') {
      setChaosPick('wildFrom');
    }
  };

  const rack = (side: 'north' | 'east' | 'west' | 'south' | 'northwest' | 'northeast' | 'southwest' | 'southeast') => {
    const seat = tableSeat(localSeat, side, seatCount) as SeatId;
    const occupant = roomSeats?.[seat] ?? null;
    const place = placeForSeat(seat, view.finishOrder, seatCount);
    const roundWinner = view.finishOrder[0];
    const placeKeys = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;
    const team = view.teamOf[seat] ?? seat % (superTable ? 3 : 2);
    return (
      <SeatRack
        seat={seat}
        language={language}
        cardCount={view.cardCounts[seat]}
        isTurn={view.currentSeat === seat}
        passed={view.trick.passedSinceLastPlay.includes(seat)}
        finished={place !== null}
        lastPlayed={lastPlayedSeat === seat}
        place={place}
        placeLabel={place ? t(language, placeKeys[place - 1] ?? 'fourth') : null}
        partner={(view.teamOf[seat] ?? 0) === youTeam}
        team={team}
        side={side}
        turnDurationMs={turnDurationMs}
        turnToken={`${view.handIndex}-${view.currentSeat}-${view.history.length}`}
        appearance={appearanceForSeat(seat, humanAppearance, localSeat)}
        dealing={dealing}
        teamLabel={t(language, team === 0 ? 'team1' : team === 1 ? 'team2' : 'team3')}
        spotlight={giveTarget === seat}
        dimmed={giveTarget !== null && giveTarget !== seat && seat !== localSeat}
        displayName={occupant ? (occupant.isYou ? t(language, 'you') : occupant.name) : undefined}
        voice={
          roomSeats
            ? {
                muted: occupant?.muted ?? true,
                speaking: occupant?.speaking ?? false,
                available: occupant?.voiceAvailable !== false,
                connection: occupant?.connection ?? 'connected',
                canControl: Boolean(occupant?.isYou && !occupant.isBot),
                onToggle: onToggleMute,
              }
            : null
        }
        connectionLabel={
          occupant?.connection === 'reconnecting' || occupant?.connection === 'restoring'
            ? t(language, 'playerReconnecting')
            : occupant?.connection === 'disconnected' || occupant?.connection === 'failed'
              ? t(language, 'disconnected')
              : occupant && occupant.voiceAvailable === false && !occupant.muted
                ? t(language, 'voiceUnavailable')
                : null
        }
        abilityMark={
          chaos
            ? seat === localSeat && ownAbility
              ? <AbilityMark glyph={ABILITY_GLYPH[ownAbility.abilityId]} consumed={ownAbility.consumed} />
              : seat !== localSeat
                ? <AbilityMark glyph="?" mystery />
                : null
            : null
        }
        frozen={Boolean(chaos?.frozenSeats.includes(seat))}
        selectable={
          pickingReact
            ? Boolean(occupant?.playerId) && seat !== localSeat
            : targeting && seat !== localSeat && place === null
        }
        onPressSeat={
          pickingReact && occupant?.playerId && seat !== localSeat
            ? () => sendReactionTo(occupant.playerId!, reactPick)
            : targeting && seat !== localSeat && place === null
              ? () => activate({ targetSeat: seat })
              : undefined
        }
        handSize={
          side === 'south' && onHandSize
            ? {
                value: clampHandSize(handSize),
                onChange: (next) => onHandSize(clampHandSize(next)),
              }
            : null
        }
        celebrateKey={roundWinner === seat ? `win-${view.handIndex}-${seat}` : null}
        gift={
          reactEnabled && occupant?.playerId && seat !== localSeat
            ? {
                disabled: coolLeft > 0,
                selected: reactTarget === occupant.playerId,
                label: t(language, 'reactionGift'),
                onPress: () => {
                  if (coolLeft > 0) {
                    return;
                  }
                  setChatOpen(false);
                  setBookOpen(false);
                  setMenuOpen(false);
                  setChaosPick('idle');
                  if (reactPick) {
                    sendReactionTo(occupant.playerId!, reactPick);
                    return;
                  }
                  setReactTarget(occupant.playerId);
                  setReactOpen(true);
                },
              }
            : null
        }
      />
    );
  };

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: padT,
            paddingLeft: padL,
            paddingRight: padR,
          },
        ]}
      >
        <View>
          <ActionOrb
            kind="menu"
            label={t(language, 'menu')}
            onPress={() => {
              setChatOpen(false);
              setBookOpen(false);
              closeReact();
              setMenuOpen((open) => !open);
            }}
          />
          {menuOpen ? (
            <View style={styles.menuSheet}>
              {chaos || superTable ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setMenuOpen(false);
                    setChatOpen(false);
                    setBookOpen(true);
                  }}
                  style={styles.menuItem}
                >
                  <Text style={styles.menuItemText}>
                    {t(language, chaos ? 'chaosBookTitle' : 'superBookTitle')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenuOpen(false);
                  onSettings();
                }}
                style={styles.menuItem}
              >
                <Text style={styles.menuItemText}>{t(language, 'settings')}</Text>
              </Pressable>
              {onFullscreen && fullscreenLabel ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: fullscreenActive }}
                  onPress={() => {
                    setMenuOpen(false);
                    onFullscreen();
                  }}
                  style={styles.menuItem}
                >
                  <Text style={styles.menuItemText}>{fullscreenLabel}</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenuOpen(false);
                  onMenu();
                }}
                style={styles.menuItem}
              >
                <Text style={styles.menuLeave}>{t(language, 'leaveGame')}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <View style={styles.topSpacer} pointerEvents="none" />
        <View style={styles.hudRight}>
          {chaos || superTable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, chaos ? 'chaosBookTitle' : 'superBookTitle')}
              onPress={() => {
                setMenuOpen(false);
                setChatOpen(false);
                closeReact();
                setBookOpen((open) => !open);
              }}
              style={styles.chatChip}
            >
              <Text style={styles.chatChipText}>{t(language, chaos ? 'chaosBookChip' : 'superBookChip')}</Text>
            </Pressable>
          ) : null}
          {onSendChat ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'chat')}
              onPress={() => {
                if (chatOpen) {
                  setChatOpen(false);
                  return;
                }
                const lastRead =
                  chatSeen > 0 && chatSeen < chat.length ? chat[chatSeen - 1] : chat[chat.length - 1];
                setChatResumeId(lastRead?.id ?? null);
                setChatOpen(true);
                closeReact();
                setBookOpen(false);
                setMenuOpen(false);
              }}
              style={styles.chatChip}
            >
              <Text style={styles.chatChipText}>{t(language, 'chat')}</Text>
              {unread > 0 ? <View style={styles.chatDot} /> : null}
            </Pressable>
          ) : null}
          <ScoreChips
            compact
            you={youScore}
            them={themScore}
            youLabel={team1Label}
            themLabel={team2Label}
            youColor={teamToken(youTeam)}
            themColor={teamToken(themTeam)}
            extra={
              extraTeam !== null
                ? { label: extraLabel, score: scoreFor(extraTeam), color: extraColor }
                : undefined
            }
          />
        </View>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.chatOverlay,
          {
            left: padL + 72,
            top: padT + 2,
            maxWidth: Math.min(168, Math.max(118, width * 0.2)),
          },
        ]}
      >
        {!chatOpen ? <TableChatFeed messages={feed} teamOf={view.teamOf} /> : null}
      </View>

      <LayoutGroup>
        <View style={styles.table} onLayout={onTableLayout}>
          <FeltCloth />
          {tableSize
            ? (superTable
                ? (['north', 'northwest', 'southwest', 'northeast', 'southeast'] as const)
                : (['north', 'west', 'east'] as const)
              ).map((side) => {
                const visual = tableSeat(0, side, seatCount);
                return (
                  <OvalSeat
                    key={side}
                    point={seatPoint(visual as SeatId, tableSize, seatCount)}
                    angle={seatAngle(visual, seatCount)}
                    bounds={tableSize}
                  >
                    {rack(side)}
                  </OvalSeat>
                );
              })
            : null}
          <View style={styles.center} pointerEvents="box-none">
            <TrickPile
              language={language}
              combination={!dealing && !exchanging && revealed ? view.trick.combination : null}
              prior={!dealing && !exchanging ? priorPlays : []}
              revealed={!dealing && revealed}
              originSeat={lastPlayedSeat}
              playedBy={lastPlayedName}
              compact={phone}
            />
          </View>
          <View
            style={[
              styles.hand,
              {
                left: handLeft,
                right: handRight,
                bottom: rimY + youBand,
                opacity: dealing ? 0 : 1,
              },
            ]}
          >
            <HandStrip
              cards={view.ownHand}
              selectedIds={selectedIds}
              legalIds={showLegalMoves ? legalCardIds : undefined}
              highlightIds={highlightIds}
              selectionLegal={selectionLegal}
              language={language}
              disabled={dealing || (!humanTurn && chaosAction !== 'wildFrom')}
              fit={handFit}
              cardMax={cardMax}
              onToggle={
                chaosAction === 'wildFrom'
                  ? (cardId) => {
                      setWildFrom(cardId);
                      setChaosPick('wildInto');
                    }
                  : onToggleCard
              }
            />
          </View>
          <View
            style={[
              styles.south,
              { left: rimX + cornerBtn, right: rimX + cornerBtn, bottom: rimY },
            ]}
          >
            {rack('south')}
          </View>
          <View
            style={[styles.passCol, { left: rimX, bottom: rimY }]}
            pointerEvents="box-none"
          >
            {chaos && ownAbility ? (
              <UiButton
                label={
                  ownAbility.consumed
                    ? t(language, 'chaosUsed')
                    : chaosAction !== 'idle'
                      ? t(language, 'cancel')
                      : t(language, CHAOS_ABILITY_NAME[ownAbility.abilityId])
                }
                variant={canUseAbility && chaosAction === 'idle' ? 'go' : 'secondary'}
                disabled={ownAbility.activationType !== 'active' || ownAbility.consumed}
                onPress={pressAbility}
                style={styles.cornerBtn}
              />
            ) : null}
            <UiButton
              label={t(language, 'pass')}
              variant="secondary"
              disabled={dealing || exchanging || !humanTurn || !view.trick.combination}
              onPress={onPass}
              style={styles.cornerBtn}
            />
          </View>
          <View style={[styles.playCol, { right: rimX, bottom: rimY }]} pointerEvents="box-none">
            <UiButton
              label={t(language, exchanging ? 'giveCard' : 'play')}
              variant="go"
              disabled={dealing || !humanTurn || selectedIds.length === 0 || selectionLegal === false}
              onPress={onPlay}
              style={styles.cornerBtn}
            />
          </View>
          {dealing ? (
            <DealFlight dealKey={dealKey} tableSize={tableSize} seatCount={seatCount} onDone={setDealtKey} />
          ) : null}
          {flying && play ? (
            <PlayFlight
              playKey={play.key}
              cards={play.cards}
              fromSeat={play.seat}
              localSeat={localSeat}
              tableSize={tableSize}
              language={language}
              seatCount={seatCount}
              onLanded={setLandedKey}
            />
          ) : null}
          <ReactionOverlay
            events={reactions}
            localSeat={localSeat}
            seatOfPlayer={seatOfPlayer}
            tableSize={tableSize}
            seatCount={seatCount}
          />
          {chaos ? (
            <ChaosFx
              notice={fxNotice && Date.now() - fxNotice.at < 2200 ? fxNotice : null}
              localSeat={localSeat}
              tableSize={tableSize}
              seatCount={seatCount}
            />
          ) : null}
          {passBurst ? (
            <PassBurst
              burstKey={passBurst.key}
              seat={passBurst.seat}
              localSeat={localSeat}
              label={t(language, 'passed')}
              tableSize={tableSize}
              seatCount={seatCount}
            />
          ) : null}
          {view.lastExchange ? (
            <ExchangeReveal
              exchange={view.lastExchange}
              language={language}
              visible={showExchange && !dealing}
              caption={exchangeCaption}
            />
          ) : null}
          {exchanging && view.pendingExchange ? (
            <ExchangeReveal
              exchange={{
                kind: 'swap',
                firstSeat: view.pendingExchange.firstSeat,
                lastSeat: view.pendingExchange.lastSeat,
                givenToFirst: view.pendingExchange.givenToFirst,
                returnedToLast: view.pendingExchange.givenToFirst,
              }}
              language={language}
              visible
              incomingOnly
              caption={
                view.pendingExchange.firstSeat === localSeat
                  ? t(language, 'exchangeIncoming', {
                      last: tableName(view.pendingExchange.lastSeat),
                      given: formatCardShort(view.pendingExchange.givenToFirst),
                    })
                  : t(language, 'exchangeChoose', {
                      name: tableName(view.pendingExchange.lastSeat),
                    })
              }
            />
          ) : null}
          <View style={[styles.roundChip, { top: padT + 6, left: padL + 44 }]} pointerEvents="none">
            <Text style={styles.roundText}>{`R${view.handIndex + 1}`}</Text>
          </View>
        </View>
      </LayoutGroup>

      {menuOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'back')}
          onPress={() => setMenuOpen(false)}
          style={styles.menuScrim}
        />
      ) : null}
      <ChaosBook
        language={language}
        visible={bookOpen && Boolean(chaos)}
        ownAbilityId={ownAbility?.abilityId}
        onClose={() => setBookOpen(false)}
      />
      <SuperBook language={language} visible={bookOpen && superTable && !chaos} onClose={() => setBookOpen(false)} />
      {chatOpen && onSendChat ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'back')}
            onPress={() => setChatOpen(false)}
            style={styles.chatScrim}
          />
          <View style={[styles.chatDock, { top: padT + 44, left: rimX, bottom: rimY + youBand + 8 }]}>
            <ChatPanel
              language={language}
              messages={chat}
              localSeat={localSeat}
              resumeMessageId={chatResumeId}
              onSend={onSendChat}
              onClose={() => setChatOpen(false)}
            />
          </View>
        </>
      ) : null}
      {reactOpen && reactEnabled ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(language, 'back')}
            onPress={closeReact}
            style={styles.reactScrim}
          />
          <View style={[styles.reactDock, { top: padT + 40, right: padR }]}>
            <ReactionTray
              language={language}
              selected={reactPick}
              onPick={(id) => {
                if (coolLeft > 0) {
                  return;
                }
                if (reactTarget) {
                  sendReactionTo(reactTarget, id);
                  return;
                }
                setReactPick(id);
              }}
            />
          </View>
        </>
      ) : null}
      {targeting ? (
        <View pointerEvents="none" style={[styles.promptPill, { bottom: rimY + youBand + 8, alignSelf: 'center' }]}>
          <Text style={styles.promptText}>{t(language, 'chaosSelectTarget')}</Text>
        </View>
      ) : null}
      {reactOpen && reactEnabled && !targeting ? (
        <View pointerEvents="none" style={[styles.promptPill, { bottom: rimY + youBand + 8, alignSelf: 'center' }]}>
          <Text style={styles.promptText}>
            {t(language, reactTarget ? 'reactionPickReaction' : 'reactionPickTarget')}
          </Text>
        </View>
      ) : null}
      {chaosAction === 'wildFrom' ? (
        <View pointerEvents="none" style={[styles.promptPill, { bottom: rimY + youBand + handFit.height + 8, alignSelf: 'center' }]}>
          <Text style={styles.promptText}>{t(language, 'chaosSelectCard')}</Text>
        </View>
      ) : null}
      {chaosAction === 'wildInto' && chaos ? (
        <View style={[styles.wildSheet, { left: rimX + 8, right: rimX + 8, bottom: rimY + youBand + 8 }]}>
          <Text style={styles.promptText}>{t(language, 'chaosSelectWild')}</Text>
          <ScrollView style={styles.wildScroll} contentContainerStyle={styles.wildRow}>
            {chaos.wildOptions.map((card) => (
              <CardFace
                key={card.id}
                card={card}
                language={language}
                size="sm"
                onPress={() => activate({ cardId: wildFrom ?? undefined, intoCardId: card.id })}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {peek ? (
        <View pointerEvents="none" style={styles.peekSheet}>
          <Text style={styles.promptText}>{t(language, 'chaosMindReaderYou')}</Text>
          <View style={styles.wildRow}>
            {peek.cards.map((card) => (
              <CardFace key={card.id} card={card} language={language} size="sm" disabled />
            ))}
          </View>
        </View>
      ) : null}
      {showNotice && latestNotice ? (
        <View pointerEvents="none" style={styles.noticeToast}>
          <Text style={styles.noticeGlyph}>{ABILITY_GLYPH[latestNotice.abilityId]}</Text>
          <Text style={styles.promptText}>{t(language, latestNotice.key as MessageKey)}</Text>
        </View>
      ) : null}
      {lastError ? <View style={styles.errorDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.room,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: spacing.sm,
    zIndex: 12,
    pointerEvents: 'box-none',
  },
  menuScrim: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  menuSheet: {
    position: 'absolute',
    top: 44,
    left: 0,
    minWidth: 168,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.28)',
    backgroundColor: 'rgba(8, 16, 18, 0.96)',
    paddingVertical: 6,
    zIndex: 13,
  },
  menuItem: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  menuItemText: {
    color: colors.cream,
    fontSize: 14,
    fontWeight: '700',
  },
  menuLeave: {
    color: colors.goldHi,
    fontSize: 14,
    fontWeight: '700',
  },
  hudRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  chatOverlay: {
    position: 'absolute',
    zIndex: 9,
  },
  topSpacer: {
    flex: 1,
    minWidth: 8,
  },
  roundChip: {
    position: 'absolute',
    minHeight: 16,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  voiceChip: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.45)',
    backgroundColor: 'rgba(232, 197, 71, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  voiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  voiceText: {
    color: colors.goldHi,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  roundText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  reactScrim: {
    ...StyleSheet.absoluteFill,
    zIndex: 11,
  },
  reactDock: {
    position: 'absolute',
    zIndex: 12,
  },
  chatChip: {
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.35)',
    backgroundColor: 'rgba(8, 18, 16, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatChipText: {
    color: colors.goldHi,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chatDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  chatScrim: {
    ...StyleSheet.absoluteFill,
    zIndex: 11,
  },
  chatDock: {
    position: 'absolute',
    width: 280,
    maxWidth: '42%',
    zIndex: 12,
  },
  passCol: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 96,
    gap: 6,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    zIndex: 7,
  },
  playCol: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 96,
    justifyContent: 'flex-end',
    zIndex: 7,
  },
  cornerBtn: {
    minWidth: 96,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  table: {
    flex: 1,
    overflow: 'visible',
  },
  center: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    top: '14%',
    bottom: '30%',
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  south: {
    position: 'absolute',
    left: 96,
    right: 96,
    bottom: 8,
    zIndex: 8,
    alignItems: 'center',
    overflow: 'visible',
  },
  hand: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 36,
    zIndex: 6,
  },
  promptPill: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(8, 18, 16, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.45)',
    zIndex: 8,
  },
  promptText: {
    color: colors.goldHi,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  wildSheet: {
    position: 'absolute',
    maxHeight: 168,
    padding: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 16, 18, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.4)',
    gap: 8,
    zIndex: 14,
  },
  wildScroll: {
    maxHeight: 128,
  },
  wildRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  peekSheet: {
    position: 'absolute',
    alignSelf: 'center',
    top: '28%',
    maxWidth: '72%',
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 16, 18, 0.94)',
    borderWidth: 1,
    borderColor: colors.goldHi,
    gap: 8,
    zIndex: 15,
    alignItems: 'center',
  },
  noticeToast: {
    position: 'absolute',
    alignSelf: 'center',
    top: 52,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(8, 16, 18, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.5)',
    zIndex: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeGlyph: {
    fontSize: 18,
  },
  errorDot: {
    position: 'absolute',
    top: 72,
    alignSelf: 'center',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
});
