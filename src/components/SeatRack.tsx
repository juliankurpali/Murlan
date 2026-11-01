import { useState, type ReactNode } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStageDimensions } from './WebStage';
import { SeatAppearance } from '../application/players';
import { HAND_SIZE_MAX, HAND_SIZE_MIN, Language } from '../application/types';
import { SeatId } from '../domain';
import { ConnectionState } from '../online/lifecycle';
import { seatName, t } from '../i18n';
import { AnimatePresence, MotionView, cardSelectTransition } from '../motion';
import { colors, fonts, teamToken } from '../theme';
import { isPhoneViewport, OPPONENT_CARD, opponentFanFit, Point, TableSize } from './tableLayout';
import { CardBack } from './CardBack';
import { SeatPortrait } from './SeatPortrait';

type Side = 'north' | 'east' | 'west' | 'south' | 'northwest' | 'northeast' | 'southwest' | 'southeast';

type Props = {
  seat: SeatId;
  language: Language;
  cardCount: number;
  isTurn: boolean;
  passed: boolean;
  finished: boolean;
  lastPlayed: boolean;
  partner?: boolean;
  side: Side;
  appearance: SeatAppearance;
  dealing?: boolean;
  teamLabel: string | null;
  team?: number;
  spotlight?: boolean;
  dimmed?: boolean;
  displayName?: string;
  voice?: {
    muted: boolean;
    speaking: boolean;
    canControl: boolean;
    available?: boolean;
    connection?: ConnectionState;
    onToggle?: () => void;
  } | null;
  connectionLabel?: string | null;
  place?: number | null;
  placeLabel?: string | null;
  turnDurationMs?: number;
  turnToken?: string;
  abilityMark?: ReactNode;
  frozen?: boolean;
  selectable?: boolean;
  onPressSeat?: () => void;
  gift?: {
    disabled?: boolean;
    selected?: boolean;
    label: string;
    onPress: () => void;
  } | null;
  handSize?: {
    value: number;
    onChange: (next: number) => void;
  } | null;
  celebrateKey?: string | null;
};

const CARD = OPPONENT_CARD;

export function OvalSeat({
  point,
  angle,
  bounds,
  children,
}: {
  point: Point;
  angle: number;
  bounds: TableSize;
  children: ReactNode;
}) {
  const [box, setBox] = useState({ w: 128, h: 52 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };
  const pad = 4;
  const out = 10;
  const left = Math.max(
    pad,
    Math.min(bounds.width - box.w - pad, point.x - box.w / 2 + Math.cos(angle) * out),
  );
  const top = Math.max(
    pad,
    Math.min(bounds.height - box.h - pad, point.y - box.h / 2 + Math.sin(angle) * out),
  );
  return (
    <View
      onLayout={onLayout}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left,
        top,
        zIndex: 3,
      }}
    >
      {children}
    </View>
  );
}

export function SeatRack({
  seat,
  language,
  cardCount,
  isTurn,
  passed,
  finished,
  lastPlayed,
  partner,
  side,
  appearance = { profileUri: null, tone: 0 },
  dealing = false,
  teamLabel,
  team = 0,
  spotlight = false,
  dimmed = false,
  displayName,
  voice = null,
  connectionLabel = null,
  place = null,
  placeLabel = null,
  turnDurationMs,
  turnToken,
  abilityMark = null,
  frozen = false,
  selectable = false,
  onPressSeat,
  gift = null,
  handSize = null,
  celebrateKey = null,
}: Props) {
  const { width, height } = useStageDimensions();
  const phone = isPhoneViewport(width, height);
  const shown = dealing || finished || side === 'south' ? 0 : Math.max(0, cardCount);
  const mid = (shown - 1) / 2;
  const name = displayName ?? seatName(language, seat);
  const leftSide = side === 'west' || side === 'northwest' || side === 'southwest';
  const rightSide = side === 'east' || side === 'northeast' || side === 'southeast';
  const sideways = leftSide || rightSide;
  const maxSpan = side === 'north' ? (phone ? 92 : 110) : phone ? 72 : 88;
  const fit = opponentFanFit(shown, maxSpan, CARD.width);
  const baseTilt = leftSide ? -90 : rightSide ? 90 : 180;
  const towardPlayer = leftSide ? -1 : rightSide ? 1 : 0;
  const bow = sideways ? 0.55 : 0.4;

  const portrait = (
    <SeatPortrait
      name={name}
      profileUri={appearance.profileUri}
      tone={appearance.tone}
      seatAccent={teamToken(team)}
      isTurn={isTurn}
      passed={passed}
      finished={finished}
      lastPlayed={lastPlayed}
      partner={partner}
      teamLabel={teamLabel}
      size={32}
      spotlight={spotlight}
      voice={voice}
      connectionLabel={connectionLabel}
      turnLabel={isTurn && side !== 'south' ? t(language, 'turn') : null}
      turnDurationMs={turnDurationMs}
      turnToken={turnToken}
      timerAbove={side !== 'south'}
      place={place}
      placeLabel={placeLabel}
      abilityMark={abilityMark}
      frozen={frozen}
      selectable={selectable}
      onPress={onPressSeat}
      gift={gift}
      celebrateKey={celebrateKey}
    />
  );

  const fan = shown > 0 ? (
    <View style={[styles.fan, sideways && styles.fanVertical, { maxWidth: sideways ? CARD.height + 4 : maxSpan }]}>
      <AnimatePresence initial={false}>
        {Array.from({ length: shown }, (_, index) => {
          const fromMid = index - mid;
          const tilt = baseTilt + fromMid * fit.tiltStep;
          return (
            <MotionView
              key={`${seat}-back-${index}`}
              layout
              initial={{ opacity: 0, scale: 0.78 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={cardSelectTransition}
              style={[
                sideways ? styles.slotSide : styles.slotNorth,
                index > 0 && (sideways ? { marginTop: -fit.overlap } : { marginLeft: -fit.overlap }),
                {
                  zIndex: index,
                  transform: sideways
                    ? [{ translateX: towardPlayer * Math.abs(fromMid) * bow }]
                    : [{ translateY: -Math.abs(fromMid) * bow }],
                },
              ]}
            >
              <CardBack size="xs" tilt={tilt} />
            </MotionView>
          );
        })}
      </AnimatePresence>
    </View>
  ) : null;

  const lastTag =
    lastPlayed && !finished ? (
      <View style={styles.lastTag}>
        <Text style={styles.lastTagText}>{t(language, 'lastPlayed')}</Text>
      </View>
    ) : null;

  const cardsBlock = (
    <View style={styles.cardsBlock}>
      {fan}
      {side !== 'south' ? lastTag : null}
    </View>
  );

  const sizeControl =
    handSize && !sideways ? (
      <View style={styles.sizeDock} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'handBigger')}
          disabled={handSize.value >= HAND_SIZE_MAX}
          hitSlop={6}
          onPress={() => handSize.onChange(handSize.value + 1)}
          style={[styles.sizeBtn, handSize.value >= HAND_SIZE_MAX && styles.sizeBtnOff]}
        >
          <Text style={styles.sizeMark}>+</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(language, 'handSmaller')}
          disabled={handSize.value <= HAND_SIZE_MIN}
          hitSlop={6}
          onPress={() => handSize.onChange(handSize.value - 1)}
          style={[styles.sizeBtn, handSize.value <= HAND_SIZE_MIN && styles.sizeBtnOff]}
        >
          <Text style={styles.sizeMark}>−</Text>
        </Pressable>
      </View>
    ) : null;

  const identity = (
    <View style={[styles.identity, sideways && styles.identitySide]}>
      {portrait}
      {sizeControl}
    </View>
  );

  return (
    <View
      accessibilityLabel={`${name}, ${cardCount}`}
      style={[
        styles.stack,
        sideways && styles.row,
        dimmed && !isTurn && styles.stackDim,
        isTurn && styles.stackTurn,
      ]}
    >
      {rightSide ? (
        <>
          {cardsBlock}
          {identity}
        </>
      ) : side === 'south' ? (
        <>
          {lastTag}
          {identity}
        </>
      ) : (
        <>
          {identity}
          {cardsBlock}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: 'center',
    gap: 1,
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    overflow: 'visible',
    position: 'relative',
  },
  sizeDock: {
    position: 'absolute',
    left: '100%',
    marginLeft: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 4,
    zIndex: 8,
  },
  sizeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 16, 18, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.5)',
  },
  sizeBtnOff: {
    opacity: 0.35,
  },
  sizeMark: {
    color: colors.goldHi,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
  identitySide: {
    flexDirection: 'row',
  },
  stackDim: {
    opacity: 0.55,
  },
  stackTurn: {
    zIndex: 6,
  },
  fan: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  fanVertical: {
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'visible',
  },
  slotNorth: {},
  slotSide: {
    width: CARD.height,
    height: CARD.width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsBlock: {
    alignItems: 'center',
    gap: 2,
  },
  lastTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(8, 18, 16, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.55)',
  },
  lastTagText: {
    color: '#f6e7a2',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
});
