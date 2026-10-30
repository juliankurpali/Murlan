import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStageDimensions } from '../components/WebStage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SeatAppearance, appearanceForSeat } from '../application/players';
import { Language } from '../application/types';
import { Card, lastPlayedSeatFromHistory, placeForSeat, PublicMatchView, SeatId } from '../domain';
import { ChatMessage } from '../online/chat';
import { RoomSeat, tableSeat } from '../online/room';
import { ActionOrb } from '../components/ActionOrb';
import { ChatPanel } from '../components/ChatPanel';
import { DealFlight } from '../components/DealFlight';
import { ExchangeReveal } from '../components/ExchangeReveal';
import { FeltCloth } from '../components/FeltCloth';
import { HandStrip } from '../components/HandStrip';
import { PassBurst } from '../components/PassBurst';
import { PlayFlight } from '../components/PlayFlight';
import { ScoreChips } from '../components/ScoreChips';
import { SeatRack } from '../components/SeatRack';
import { TableChatFeed } from '../components/TableChatFeed';
import { TableSize, fitHandCards, handCardMax, handSideInset, isPhoneViewport } from '../components/tableLayout';
import { TrickPile } from '../components/TrickPile';
import { UiButton } from '../components/UiButton';
import { seatName, t } from '../i18n';
import { LayoutGroup } from '../motion';
import { colors, motion, spacing } from '../theme';

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
  turnProgress: number;
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
};

function playSignature(view: PublicMatchView): { key: string; seat: SeatId; cards: Card[] } | null {
  for (let index = view.history.length - 1; index >= 0; index -= 1) {
    const event = view.history[index];
    if (event?.kind === 'play') {
      return {
        key: `${view.handIndex}-${event.seat}-${event.cards.map((card) => card.id).join(',')}`,
        seat: event.seat,
        cards: event.cards,
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
  turnProgress,
  humanAppearance,
  localSeat = 0,
  roomSeats = null,
  chat = [],
  onSendChat,
  onToggleMute,
  onToggleCard,
  onPlay,
  onPass,
  onMenu,
  onSettings,
}: Props) {
  const { width, height } = useStageDimensions();
  const insets = useSafeAreaInsets();
  const phone = isPhoneViewport(width, height);
  const cardMax = handCardMax(width, height);
  const padL = Math.max(insets.left, 8);
  const padR = Math.max(insets.right, 8);
  const padT = Math.max(insets.top, 6);
  const padB = Math.max(insets.bottom, 8);
  const rimX = Math.max(padL, padR);
  const rimY = Math.max(padT, padB);
  const lastPlayedSeat = lastPlayedSeatFromHistory(view.history);
  const play = useMemo(() => playSignature(view), [view]);
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
  const [hintOn, setHintOn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeen, setChatSeen] = useState(0);
  const [chatResumeId, setChatResumeId] = useState<string | null>(null);
  const [feed, setFeed] = useState<ChatMessage[]>([]);
  const feedTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const joinedAt = useRef(Date.now());
  const unread = Math.max(0, chat.length - chatSeen);
  const lastChat = chat[chat.length - 1] ?? null;
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

  useEffect(() => {
    if (!showExchange || !exchangeKey) {
      return;
    }
    const handle = setTimeout(() => setSeenExchange(exchangeKey), 2200);
    return () => clearTimeout(handle);
  }, [showExchange, exchangeKey]);

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
    setHintOn(false);
  }, [view.history.length, view.currentSeat]);

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

  const sharedLayout = Platform.OS === 'web';
  const flying = !sharedLayout && Boolean(play && play.key !== landedKey);
  const revealed = !flying;
  const youTeam = localSeat % 2;
  const youScore = view.teamScores
    ? youTeam === 0
      ? view.teamScores.team0
      : view.teamScores.team1
    : view.scores[localSeat];
  const themScore = view.teamScores
    ? youTeam === 0
      ? view.teamScores.team1
      : view.teamScores.team0
    : Math.max(...view.scores.filter((_, index) => index !== localSeat));

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

  const rack = (side: 'north' | 'east' | 'west' | 'south') => {
    const seat = tableSeat(localSeat, side) as SeatId;
    const occupant = roomSeats?.[seat] ?? null;
    const place = placeForSeat(seat, view.finishOrder);
    const placeKeys = ['first', 'second', 'third', 'fourth'] as const;
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
        partner={view.mode === '2v2' && seat % 2 === localSeat % 2}
        side={side}
        turnProgress={view.currentSeat === seat ? turnProgress : 0}
        appearance={appearanceForSeat(seat, humanAppearance, localSeat)}
        dealing={dealing}
        teamLabel={view.mode === '2v2' ? t(language, seat % 2 === 0 ? 'team1' : 'team2') : null}
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
              setMenuOpen((open) => !open);
            }}
          />
          {menuOpen ? (
            <View style={styles.menuSheet}>
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
            target={view.targetScore}
            youLabel={view.mode === '2v2' ? t(language, 'teamYou') : t(language, 'you')}
            themLabel={t(language, 'teamOpp')}
            targetLabel={t(language, 'target', { score: view.targetScore })}
          />
          <View style={styles.roundChip}>
            <Text style={styles.roundText}>{`R${view.handIndex + 1}`}</Text>
          </View>
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
        {!chatOpen ? <TableChatFeed messages={feed} /> : null}
      </View>

      <LayoutGroup>
        <View style={styles.table} onLayout={onTableLayout}>
          <FeltCloth />
          <View style={[styles.north, { top: rimY }]}>{rack('north')}</View>
          <View style={[styles.west, { left: rimX }]}>{rack('west')}</View>
          <View style={[styles.east, { right: rimX }]}>{rack('east')}</View>
          <View style={styles.center} pointerEvents="box-none">
            {humanTurn && !dealing && !exchanging ? (
              <View style={styles.turnChip} pointerEvents="none">
                <Text style={styles.turnChipText}>{t(language, 'yourTurn')}</Text>
              </View>
            ) : null}
            <TrickPile
              language={language}
              combination={!dealing && !exchanging && revealed ? view.trick.combination : null}
              revealed={!dealing && revealed}
              originSeat={lastPlayedSeat}
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
              legalIds={showLegalMoves || hintOn ? legalCardIds : undefined}
              selectionLegal={selectionLegal}
              language={language}
              disabled={dealing || !humanTurn}
              fit={handFit}
              cardMax={cardMax}
              onToggle={onToggleCard}
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
          {exchanging && view.pendingExchange ? (
            <View
              style={[
                styles.promptPill,
                {
                  left: handLeft,
                  right: handRight,
                  bottom: rimY + youBand + handFit.height + handFit.lift + 4,
                },
              ]}
            >
              <Text style={styles.promptText}>
                {t(language, 'exchangeChoose', { name: seatName(language, view.pendingExchange.lastSeat) })}
              </Text>
            </View>
          ) : null}
          <View
            style={[styles.passCol, { left: rimX, bottom: rimY }]}
            pointerEvents="box-none"
          >
            <UiButton
              label={t(language, 'hint')}
              variant="ghost"
              disabled={dealing || exchanging || !humanTurn || legalCardIds.size === 0}
              onPress={() => setHintOn(true)}
              style={styles.hintBtn}
            />
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
            <DealFlight dealKey={dealKey} tableSize={tableSize} onDone={setDealtKey} />
          ) : null}
          {flying && play ? (
            <PlayFlight
              playKey={play.key}
              cards={play.cards}
              fromSeat={play.seat}
              localSeat={localSeat}
              tableSize={tableSize}
              language={language}
              onLanded={setLandedKey}
            />
          ) : null}
          {passBurst ? (
            <PassBurst
              burstKey={passBurst.key}
              seat={passBurst.seat}
              localSeat={localSeat}
              label={t(language, 'passed')}
              tableSize={tableSize}
            />
          ) : null}
          {view.lastExchange ? (
            <ExchangeReveal
              exchange={view.lastExchange}
              language={language}
              visible={showExchange && !dealing}
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
            />
          ) : null}
          <View
            accessibilityLabel={t(language, 'firstToGoOut')}
            style={[styles.infoDot, { top: padT + 6, left: padL + 44 }]}
          >
            <Text style={styles.infoMark}>i</Text>
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
    minHeight: 22,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
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
  hintBtn: {
    minHeight: 28,
    minWidth: 96,
    paddingHorizontal: 8,
  },
  table: {
    flex: 1,
    overflow: 'visible',
  },
  north: {
    position: 'absolute',
    top: 8,
    left: '22%',
    right: '22%',
    alignItems: 'center',
    zIndex: 2,
  },
  west: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 3,
  },
  east: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 3,
  },
  center: {
    position: 'absolute',
    left: '22%',
    right: '22%',
    top: '28%',
    bottom: '28%',
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnChip: {
    position: 'absolute',
    top: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 18, 16, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.35)',
  },
  turnChipText: {
    color: colors.goldHi,
    fontSize: 11,
    fontWeight: '700',
  },
  infoDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  infoMark: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  south: {
    position: 'absolute',
    left: 96,
    right: 96,
    bottom: 8,
    zIndex: 3,
    alignItems: 'center',
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
