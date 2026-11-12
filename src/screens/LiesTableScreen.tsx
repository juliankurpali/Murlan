import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SeatAppearance, appearanceForSeat } from '../application/players';
import { Language } from '../application/types';
import { ActionOrb } from '../components/ActionOrb';
import { CardBack } from '../components/CardBack';
import { CardFace } from '../components/CardFace';
import { ChatPanel } from '../components/ChatPanel';
import { FeltCloth } from '../components/FeltCloth';
import { HandStrip } from '../components/HandStrip';
import { LiesBook } from '../components/LiesBook';
import { LiesClaimFlight } from '../components/LiesClaimFlight';
import { LiesTakeReveal } from '../components/LiesTakeReveal';
import { OvalSeat, SeatRack } from '../components/SeatRack';
import { TableChatFeed } from '../components/TableChatFeed';
import { UiButton } from '../components/UiButton';
import { useStageDimensions } from '../components/WebStage';
import { liesSheetMetrics } from '../components/liesSheet';
import {
  FLIGHT_CARD,
  FLIGHT_CARD_PHONE,
  fanSpread,
  fitHandCards,
  handCardMax,
  handSideInset,
  isPhoneViewport,
  scaledHandCard,
  seatAngle,
  seatPoint,
  TableSize,
} from '../components/tableLayout';
import {
  Card,
  LiesSeatAct,
  PublicLiesView,
  SeatId,
  STANDARD_RANKS,
  StandardRank,
  SUITS,
  rankLabel,
  sortHand,
} from '../domain';
import { ChatMessage } from '../online/chat';
import { RoomSeat, TableSide, tableSeat } from '../online/room';
import { baseBotName } from '../platform/ids';
import { MessageKey, seatName, t } from '../i18n';
import { LayoutGroup } from '../motion';
import { colors, fonts, motion, radius, spacing } from '../theme';

const ACT_KEY: Record<LiesSeatAct, MessageKey> = {
  added: 'liesActAdded',
  believed: 'liesActBelieved',
  calledLie: 'liesActCalledLie',
  cleared: 'liesActCleared',
  tookPile: 'liesActTookPile',
};

type Props = {
  language: Language;
  view: PublicLiesView;
  localSeat: SeatId;
  roomSeats?: RoomSeat[] | null;
  humanAppearance?: SeatAppearance | null;
  legalCardIds: string[];
  humanTurn: boolean;
  turnDurationMs?: number;
  chat?: ChatMessage[];
  onSendChat?: (text: string) => void;
  onToggleMute?: () => void;
  onClaim: (cardIds: string[], rank: StandardRank) => void;
  onBelieve: () => void;
  onChallenge: () => void;
  onClear: () => void;
  onLeave: () => void;
  onSettings?: () => void;
};

function LiesPileCenter({
  language,
  pileCount,
  claim,
  byName,
  compact,
}: {
  language: Language;
  pileCount: number;
  claim: { count: number; rank: StandardRank } | null;
  byName: string | null;
  compact: boolean;
}) {
  const base = compact ? FLIGHT_CARD_PHONE : FLIGHT_CARD;
  const dim = {
    width: Math.round(base.width * (compact ? 0.62 : 0.68)),
    height: Math.round(base.height * (compact ? 0.62 : 0.68)),
  };
  const claimDim = {
    width: Math.round(dim.width * 0.86),
    height: Math.round(dim.height * 0.86),
  };
  // Every played card is a face-down back; tighten the cascade so big piles stay readable.
  const backs = Math.max(0, pileCount);
  const maxSpanX = compact ? 34 : 42;
  const maxSpanY = compact ? 26 : 32;
  const stepX =
    backs <= 1 ? 0 : Math.min(compact ? 2.8 : 3.2, maxSpanX / Math.max(1, backs - 1));
  const stepY =
    backs <= 1 ? 0 : Math.min(compact ? 2.0 : 2.4, maxSpanY / Math.max(1, backs - 1));
  const stackW = dim.width + Math.round(stepX * Math.max(0, backs - 1)) + 4;
  const stackH = dim.height + Math.round(stepY * Math.max(0, backs - 1)) + 4;
  const faces: Card[] = claim
    ? Array.from({ length: Math.max(1, Math.min(claim.count, 4)) }, (_, index) => ({
        id: `claim-sample-${claim.rank}-${index}`,
        kind: 'standard',
        suit: SUITS[index % SUITS.length]!,
        rank: claim.rank,
      }))
    : [];
  const lit = pileCount > 0 || Boolean(claim);

  return (
    <View style={styles.trick} accessibilityLabel={t(language, 'liesPile', { count: pileCount })}>
      <View pointerEvents="none" style={[styles.glow, lit ? null : styles.glowDim]} />
      <View style={styles.play}>
        {claim && byName ? (
          <View style={styles.playedBy} pointerEvents="none">
            <Text style={styles.playedByName} numberOfLines={1}>
              {`${byName} · ${claim.count}× ${rankLabel(claim.rank)}`}
            </Text>
          </View>
        ) : pileCount > 0 ? (
          <View style={styles.playedBy} pointerEvents="none">
            <Text style={styles.playedByName} numberOfLines={1}>
              {t(language, 'liesPile', { count: pileCount })}
            </Text>
          </View>
        ) : null}
        <View style={styles.pileRow}>
          <View style={[styles.stack, { width: stackW, height: stackH }]}>
            {backs > 0
              ? Array.from({ length: backs }, (_, i) => (
                  <View
                    key={`back-${i}`}
                    style={[
                      styles.pileCard,
                      {
                        left: Math.round(i * stepX),
                        top: Math.round(i * stepY),
                        zIndex: i,
                      },
                    ]}
                  >
                    <CardBack width={dim.width} height={dim.height} />
                  </View>
                ))
              : null}
          </View>
          {faces.length > 0 ? (
            <View style={styles.claimSide}>
              {faces.map((card, index) => {
                const fan = fanSpread(index, faces.length);
                return (
                  <View
                    key={card.id}
                    style={{
                      marginLeft: index === 0 ? 0 : compact ? -10 : -9,
                      zIndex: index + 10,
                      transform: [{ rotate: `${fan.rotate * 0.6}deg` }, { translateY: fan.y * 0.5 }],
                    }}
                  >
                    <CardFace
                      card={card}
                      language={language}
                      width={claimDim.width}
                      height={claimDim.height}
                      elevated
                      disabled
                      sharedLayout={false}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function LiesTableScreen({
  language,
  view,
  localSeat,
  roomSeats = null,
  humanAppearance = null,
  legalCardIds,
  humanTurn,
  turnDurationMs = motion.humanTurnMs,
  chat = [],
  onSendChat,
  onToggleMute,
  onClaim,
  onBelieve,
  onChallenge,
  onClear,
  onLeave,
  onSettings,
}: Props) {
  const { width, height } = useStageDimensions();
  const insets = useSafeAreaInsets();
  const phone = isPhoneViewport(width, height);
  const seatCount = view.playerCount;
  const padL = Math.max(insets.left, 8);
  const padR = Math.max(insets.right, 8);
  const padT = Math.max(insets.top, 6);
  const padB = Math.max(insets.bottom, 8);
  const rimX = Math.max(padL, padR);
  const rimY = Math.max(padT, padB);
  const cornerBtn = phone ? 168 : 188;
  const youBand = phone ? 52 : 60;

  const [selected, setSelected] = useState<string[]>([]);
  const [claimOpen, setClaimOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSeen, setChatSeen] = useState(0);
  const [dismissedRevealAt, setDismissedRevealAt] = useState(0);
  const [landedPlayAt, setLandedPlayAt] = useState(0);
  const [tableSize, setTableSize] = useState<TableSize | null>(null);

  const tableWidth = tableSize?.width ?? width;
  const handInset = Math.max(handSideInset(tableWidth), cornerBtn);
  const handLeft = rimX + handInset;
  const handRight = rimX + handInset;
  const cardMax = scaledHandCard(handCardMax(width, height), 1);
  const legalSet = useMemo(() => new Set(legalCardIds), [legalCardIds]);
  const orderedHand = useMemo(() => sortHand(view.ownHand), [view.ownHand]);
  const handFit = fitHandCards(orderedHand.length, tableWidth - handLeft - handRight, cardMax);
  const unread = Math.max(0, chat.length - chatSeen);
  const claim = view.lastClaim;
  const showReveal = Boolean(view.lastReveal && view.lastReveal.at !== dismissedRevealAt);
  const showClaimFlight = Boolean(view.lastPlay && view.lastPlay.at !== landedPlayAt && !showReveal);
  const flyingCount = showClaimFlight && view.lastPlay ? view.lastPlay.count : 0;
  const shownPileCount = Math.max(0, view.pileCount - flyingCount);

  const selectedCards = useMemo(
    () => orderedHand.filter((card) => selected.includes(card.id)),
    [orderedHand, selected],
  );

  useEffect(() => {
    setSelected((prev) => prev.filter((id) => orderedHand.some((card) => card.id === id)));
  }, [orderedHand]);

  useEffect(() => {
    if (chatOpen) setChatSeen(chat.length);
  }, [chatOpen, chat.length]);

  const toggleCard = (cardId: string) => {
    if (!view.canClaim) return;
    if (legalSet.size > 0 && !legalSet.has(cardId)) return;
    setSelected((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= view.maxPlay) return prev;
      return [...prev, cardId];
    });
  };

  const openClaim = () => {
    if (selected.length < 1) return;
    setClaimOpen(true);
  };

  const confirmClaim = (rank: StandardRank) => {
    onClaim(selected, rank);
    setSelected([]);
    setClaimOpen(false);
  };

  const nameForSeat = (seat: SeatId): string => {
    if (seat === localSeat) {
      return t(language, 'you');
    }
    const occupant = roomSeats?.[seat];
    if (occupant?.name) {
      return baseBotName(occupant.name);
    }
    return baseBotName(seatName(language, seat));
  };

  const seatNames = useMemo(
    () => Array.from({ length: seatCount }, (_, seat) => nameForSeat(seat as SeatId)),
    [seatCount, localSeat, roomSeats, language],
  );

  const status =
    view.phase === 'lastConfirm' && view.currentSeat === localSeat
      ? t(language, 'liesLastConfirm')
      : view.phase === 'claiming' && view.currentSeat === localSeat
        ? t(language, 'liesYourLead')
        : view.phase === 'responding' && view.currentSeat === localSeat
          ? t(language, 'yourTurn')
          : t(language, 'waitingFor', { name: seatNames[view.currentSeat] ?? '…' });

  const onTableLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    setTableSize((prev) =>
      prev && prev.width === next.width && prev.height === next.height
        ? prev
        : { width: next.width, height: next.height },
    );
  };

  const rack = (side: TableSide) => {
    const seat = tableSeat(localSeat, side, seatCount) as SeatId;
    const occupant = roomSeats?.[seat] ?? null;
    const finished = view.finishOrder.includes(seat);
    const place = finished ? view.finishOrder.indexOf(seat) + 1 : null;
    const placeKeys = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;
    const lastAct = view.lastActs[seat] ?? null;
    const lastAdder = claim?.seat === seat;
    return (
      <SeatRack
        seat={seat}
        language={language}
        cardCount={view.cardCounts[seat] ?? 0}
        isTurn={view.currentSeat === seat}
        passed={false}
        finished={finished}
        lastPlayed={lastAdder}
        place={place}
        placeLabel={place ? t(language, placeKeys[place - 1] ?? 'fourth') : null}
        partner={false}
        team={seat % Math.max(2, Math.min(3, seatCount))}
        side={side}
        turnDurationMs={turnDurationMs}
        turnToken={`${view.phase}-${view.currentSeat}-${view.pileCount}-${view.respondersLeft.join('.')}-${view.lastPlay?.at ?? 0}-${view.lastReveal?.at ?? 0}-${view.finishOrder.join('.')}`}
        appearance={appearanceForSeat(seat, humanAppearance, localSeat)}
        teamLabel={lastAct && !finished ? t(language, ACT_KEY[lastAct]) : null}
        displayName={nameForSeat(seat)}
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
              : null
        }
      />
    );
  };

  const showRespond = view.canBelieve || view.canChallenge;
  const showClear = view.canClear;
  const showClaim = view.canClaim;

  const claimPick = useMemo(() => {
    const sheet = liesSheetMetrics(width, height, padL, padR, padT, padB);
    const gap = phone ? 8 : 10;
    const inner = Math.max(200, sheet.width - sheet.padding * 2);
    // Prefer fewer, larger ranks so faces stay readable on phone.
    const target = phone ? 48 : 46;
    const cols = Math.max(4, Math.min(phone ? 6 : 7, Math.floor((inner + gap) / (target + gap))));
    const rankW = Math.max(phone ? 44 : 42, Math.min(phone ? 56 : 52, Math.floor((inner - gap * (cols - 1)) / cols)));
    const rankH = Math.round(rankW * (70 / 48));
    const chrome = phone ? 120 : 150;
    return {
      sheet,
      gap,
      rankW,
      rankH,
      gridMaxH: Math.max(rankH * 2 + gap + 16, Math.min(sheet.maxHeight - chrome, phone ? sheet.maxHeight * 0.58 : 280)),
      selectedW: sheet.cardW,
      selectedH: sheet.cardH,
      fixedW: phone ? Math.min(72, Math.round(Math.min(sheet.maxHeight * 0.28, sheet.width * 0.18))) : 72,
      fixedH: phone ? Math.min(104, Math.round(Math.min(sheet.maxHeight * 0.4, sheet.width * 0.26))) : 104,
    };
  }, [width, height, phone, padL, padR, padT, padB]);

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: padT, paddingLeft: padL, paddingRight: padR }]}>
        <View>
          <ActionOrb
            kind="menu"
            label={t(language, 'menu')}
            onPress={() => {
              setChatOpen(false);
              setBookOpen(false);
              setMenuOpen((open) => !open);
            }}
          />
          {menuOpen ? (
            <View style={styles.menuSheet}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenuOpen(false);
                  setBookOpen(true);
                }}
                style={styles.menuItem}
              >
                <Text style={styles.menuItemText}>{t(language, 'liesBookTitle')}</Text>
              </Pressable>
              {onSettings ? (
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
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenuOpen(false);
                  onLeave();
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
          <View
            pointerEvents="none"
            style={styles.removedChip}
            accessibilityLabel={`${t(language, 'liesRemovedHint')}: ${view.removedCount}`}
          >
            <Text style={styles.removedCaption}>{t(language, 'liesRemoved')}</Text>
            <Text style={styles.removedScore}>{view.removedCount}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMenuOpen(false);
              setChatOpen(false);
              setBookOpen((open) => !open);
            }}
            style={styles.chatChip}
          >
            <Text style={styles.chatChipText}>{t(language, 'liesBookChip')}</Text>
          </Pressable>
          {onSendChat ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(language, 'chat')}
              onPress={() => {
                setBookOpen(false);
                setMenuOpen(false);
                setChatOpen((open) => !open);
              }}
              style={styles.chatChip}
            >
              <Text style={styles.chatChipText}>{t(language, 'chat')}</Text>
              {unread > 0 && !chatOpen ? <View style={styles.chatDot} /> : null}
            </Pressable>
          ) : null}
        </View>
      </View>

      <View
        pointerEvents="none"
        style={[styles.chatOverlay, { left: padL + 72, top: padT + 2, maxWidth: Math.min(168, Math.max(118, width * 0.2)) }]}
      >
        {!chatOpen ? <TableChatFeed messages={chat.slice(-4)} /> : null}
      </View>

      <LayoutGroup>
        <View style={styles.table} onLayout={onTableLayout}>
          <FeltCloth />
          {tableSize
            ? (
                seatCount >= 6
                  ? (['north', 'northwest', 'southwest', 'northeast', 'southeast'] as const)
                  : seatCount === 5
                    ? (['southwest', 'northwest', 'northeast', 'southeast'] as const)
                    : seatCount === 3
                      ? (['west', 'east'] as const)
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
            <LiesPileCenter
              language={language}
              pileCount={shownPileCount}
              claim={showClaimFlight ? null : claim}
              byName={!showClaimFlight && claim ? (seatNames[claim.seat] ?? `P${claim.seat + 1}`) : null}
              compact={phone}
            />
          </View>

          <View style={[styles.hand, { left: handLeft, right: handRight, bottom: rimY + youBand }]}>
            <HandStrip
              language={language}
              cards={orderedHand}
              selectedIds={selected}
              legalIds={view.canClaim ? (legalSet.size > 0 ? legalSet : undefined) : new Set()}
              selectionLegal={selected.length > 0 ? true : null}
              fit={handFit}
              cardMax={cardMax}
              onToggle={toggleCard}
              disabled={!humanTurn || !view.canClaim || showReveal}
            />
          </View>

          <View style={[styles.south, { left: rimX + cornerBtn, right: rimX + cornerBtn, bottom: rimY }]}>
            {rack('south')}
          </View>

          <View style={[styles.passCol, { left: rimX, bottom: rimY, width: cornerBtn - 8 }]} pointerEvents="box-none">
            {showClear ? (
              <UiButton
                label={t(language, 'liesClearPile')}
                variant="go"
                disabled={!humanTurn || showReveal}
                onPress={onClear}
                style={styles.cornerBtnWide}
              />
            ) : null}
            <View style={styles.respondRow}>
              <UiButton
                label={t(language, 'liesBelieve')}
                variant="secondary"
                disabled={!humanTurn || !view.canBelieve || showReveal}
                onPress={onBelieve}
                style={styles.respondBtn}
              />
              <UiButton
                label={t(language, 'liesCallLie')}
                variant="primary"
                disabled={!humanTurn || !view.canChallenge || showReveal}
                onPress={onChallenge}
                style={styles.respondBtn}
              />
            </View>
          </View>

          <View style={[styles.playCol, { right: rimX, bottom: rimY }]} pointerEvents="box-none">
            <UiButton
              label={t(language, showRespond || showClear ? 'liesAdd' : 'play')}
              variant="go"
              disabled={!humanTurn || !view.canClaim || selected.length < 1 || showReveal}
              onPress={openClaim}
              style={styles.cornerBtn}
            />
          </View>

          {showClaimFlight && view.lastPlay ? (
            <LiesClaimFlight
              playKey={`lies-claim-${view.lastPlay.at}-${view.lastPlay.seat}`}
              count={view.lastPlay.count}
              landFromIndex={shownPileCount}
              fromSeat={view.lastPlay.seat}
              localSeat={localSeat}
              tableSize={tableSize}
              seatCount={seatCount}
              onLanded={() => setLandedPlayAt(view.lastPlay!.at)}
            />
          ) : null}

          {showReveal && view.lastReveal ? (
            <LiesTakeReveal
              language={language}
              reveal={view.lastReveal}
              localSeat={localSeat}
              seatNames={seatNames}
              tableSize={tableSize}
              seatCount={seatCount}
              onDone={() => setDismissedRevealAt(view.lastReveal!.at)}
            />
          ) : null}
        </View>
      </LayoutGroup>

      <View
        pointerEvents="none"
        style={[styles.promptPill, { bottom: rimY + youBand + handFit.height + 8, alignSelf: 'center' }]}
      >
        <Text style={styles.promptText}>{status}</Text>
      </View>

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
              onSend={onSendChat}
              onClose={() => setChatOpen(false)}
            />
          </View>
        </>
      ) : null}

      <Modal visible={claimOpen} transparent animationType="fade" onRequestClose={() => setClaimOpen(false)}>
        <View
          style={[
            styles.modalScrim,
            {
              paddingTop: Math.max(padT, phone ? 10 : 16),
              paddingBottom: Math.max(padB, phone ? 10 : 16),
              paddingLeft: Math.max(padL, phone ? 12 : 20),
              paddingRight: Math.max(padR, phone ? 12 : 20),
            },
          ]}
        >
          <View
            style={[
              styles.modal,
              {
                width: claimPick.sheet.width,
                maxHeight: claimPick.sheet.maxHeight,
                padding: claimPick.sheet.padding,
                gap: claimPick.sheet.gap,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { fontSize: claimPick.sheet.titleSize }]}>
              {t(language, 'liesClaimTitle')}
            </Text>
            <Text
              style={[styles.modalHint, { fontSize: claimPick.sheet.hintSize }, phone && styles.modalHintPhone]}
              numberOfLines={phone ? 2 : 3}
            >
              {t(language, 'liesClaimHint')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.revealRow, { minHeight: claimPick.selectedH + 4 }]}
              style={[styles.revealScroll, { maxHeight: claimPick.selectedH + 8 }]}
            >
              {selectedCards.map((card) => (
                <CardFace
                  key={card.id}
                  card={card}
                  language={language}
                  width={claimPick.selectedW}
                  height={claimPick.selectedH}
                  disabled
                  sharedLayout={false}
                />
              ))}
            </ScrollView>
            {view.claimedRank !== null ? (
              <View style={styles.fixedRank}>
                <Pressable onPress={() => confirmClaim(view.claimedRank!)} style={styles.rankFaceHit}>
                  <CardFace
                    card={{
                      id: `pick-${view.claimedRank}`,
                      kind: 'standard',
                      suit: 'spades',
                      rank: view.claimedRank,
                    }}
                    language={language}
                    width={claimPick.fixedW}
                    height={claimPick.fixedH}
                    onPress={() => confirmClaim(view.claimedRank!)}
                    sharedLayout={false}
                  />
                </Pressable>
                <UiButton
                  label={`${t(language, 'liesConfirmClaim')} ×${selectedCards.length}`}
                  onPress={() => confirmClaim(view.claimedRank!)}
                  style={styles.modalBtn}
                />
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: claimPick.gridMaxH, minHeight: claimPick.rankH + 12 }}
                contentContainerStyle={[styles.rankFaces, { gap: claimPick.gap }]}
                showsVerticalScrollIndicator
              >
                {STANDARD_RANKS.map((rank) => (
                  <Pressable key={rank} onPress={() => confirmClaim(rank)} style={styles.rankFaceHit}>
                    <CardFace
                      card={{ id: `pick-${rank}`, kind: 'standard', suit: 'spades', rank }}
                      language={language}
                      width={claimPick.rankW}
                      height={claimPick.rankH}
                      onPress={() => confirmClaim(rank)}
                      sharedLayout={false}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <UiButton
              label={t(language, 'back')}
              variant="ghost"
              onPress={() => setClaimOpen(false)}
              style={styles.modalBtn}
            />
          </View>
        </View>
      </Modal>

      <LiesBook language={language} visible={bookOpen} onClose={() => setBookOpen(false)} />
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
  topSpacer: { flex: 1, minWidth: 8 },
  hudRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  removedChip: {
    minHeight: 28,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.35)',
    backgroundColor: 'rgba(8, 18, 16, 0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  removedCaption: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  removedScore: {
    color: colors.goldHi,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'right',
  },
  menuScrim: { ...StyleSheet.absoluteFill, zIndex: 10 },
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
  menuItem: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14 },
  menuItemText: { color: colors.cream, fontSize: 14, fontWeight: '700' },
  menuLeave: { color: colors.goldHi, fontSize: 14, fontWeight: '700' },
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
  chatOverlay: { position: 'absolute', zIndex: 9 },
  chatScrim: { ...StyleSheet.absoluteFill, zIndex: 11 },
  chatDock: { position: 'absolute', zIndex: 12, width: 280, maxWidth: '42%' },
  table: { flex: 1, overflow: 'visible' },
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
  trick: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'visible',
    position: 'relative',
  },
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stack: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pileCard: {
    position: 'absolute',
  },
  claimSide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 8,
    paddingLeft: 2,
  },
  glow: {
    position: 'absolute',
    width: 140,
    height: 78,
    borderRadius: 100,
    backgroundColor: 'rgba(200, 193, 161, 0.1)',
  },
  glowDim: {
    opacity: 0.14,
    transform: [{ scale: 0.78 }],
  },
  playedBy: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 4,
    alignItems: 'center',
    maxWidth: 150,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(8, 18, 16, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.5)',
    zIndex: 6,
  },
  playedByName: {
    color: colors.goldHi,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  hand: { position: 'absolute', zIndex: 6 },
  south: { position: 'absolute', zIndex: 8, alignItems: 'center', overflow: 'visible' },
  passCol: {
    position: 'absolute',
    zIndex: 7,
    gap: 6,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
  },
  respondRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  respondBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    paddingHorizontal: 6,
  },
  playCol: {
    position: 'absolute',
    zIndex: 7,
    width: 96,
    justifyContent: 'flex-end',
  },
  cornerBtn: { minWidth: 96, minHeight: 42, paddingHorizontal: 12 },
  cornerBtnWide: { minHeight: 42, paddingHorizontal: 10 },
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
  modalScrim: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    alignSelf: 'center',
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'visible',
  },
  modalTitle: { color: colors.cream, fontFamily: fonts.sans, fontWeight: '800', fontSize: 22 },
  modalTitlePhone: { fontSize: 18 },
  modalHint: { color: colors.muted, fontFamily: fonts.sans, fontSize: 13 },
  modalHintPhone: { fontSize: 12, lineHeight: 16 },
  modalBtn: { alignSelf: 'stretch', minHeight: 40 },
  revealScroll: { flexGrow: 0 },
  revealRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  fixedRank: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  rankFaces: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  rankFaceHit: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(232,197,71,0.55)',
    backgroundColor: 'rgba(8,14,18,0.7)',
    padding: 4,
  },
});
