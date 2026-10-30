import { useState, type ReactNode } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SeatAppearance } from '../application/players';
import { Language } from '../application/types';
import { SeatId } from '../domain';
import { ConnectionState } from '../online/lifecycle';
import { seatName, t } from '../i18n';
import { AnimatePresence, MotionView, cardSelectTransition } from '../motion';
import { fonts, seatToken } from '../theme';
import { isPhoneViewport, opponentFanFit } from './tableLayout';
import { CardBack } from './CardBack';
import { SeatPortrait } from './SeatPortrait';

type Side = 'north' | 'east' | 'west' | 'south';

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
  turnProgress: number;
  appearance: SeatAppearance;
  dealing?: boolean;
  teamLabel: string | null;
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
};

const CARD = { width: 26, height: 38 };

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
  turnProgress,
  appearance = { profileUri: null, tone: 0 },
  dealing = false,
  teamLabel,
  spotlight = false,
  dimmed = false,
  displayName,
  voice = null,
  connectionLabel = null,
  place = null,
  placeLabel = null,
}: Props) {
  const { width, height } = useWindowDimensions();
  const phone = isPhoneViewport(width, height);
  const shown = dealing || finished || side === 'south' ? 0 : Math.max(0, cardCount);
  const mid = (shown - 1) / 2;
  const name = displayName ?? seatName(language, seat);
  const sideways = side === 'west' || side === 'east';
  const maxSpan = side === 'north' ? (phone ? 148 : 190) : phone ? 132 : 168;
  const fit = opponentFanFit(shown, maxSpan, CARD.width);
  const baseTilt = side === 'west' ? -90 : side === 'east' ? 90 : 180;
  const towardPlayer = side === 'west' ? -1 : side === 'east' ? 1 : 0;

  const portrait = (
    <SeatPortrait
      name={name}
      profileUri={appearance.profileUri}
      tone={appearance.tone}
      seatAccent={seatToken[seat]}
      isTurn={isTurn}
      passed={passed}
      finished={finished}
      lastPlayed={lastPlayed}
      partner={partner}
      turnProgress={turnProgress}
      teamLabel={teamLabel}
      size={32}
      spotlight={spotlight}
      voice={voice}
      connectionLabel={connectionLabel}
      turnLabel={isTurn && side !== 'south' ? t(language, 'turn') : null}
      place={place}
      placeLabel={placeLabel}
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
                    ? [{ translateX: towardPlayer * Math.abs(fromMid) * 1.6 }]
                    : [{ translateY: -Math.abs(fromMid) * 1.1 }],
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

  const identity = <View style={styles.identity}>{portrait}</View>;

  const seatedIdentity =
    side === 'west' || side === 'east' ? (
      <RotatedSeatLayout degrees={side === 'west' ? -90 : 90}>{identity}</RotatedSeatLayout>
    ) : (
      identity
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
      {side === 'east' ? (
        <>
          {cardsBlock}
          {seatedIdentity}
        </>
      ) : side === 'south' ? (
        <>
          {lastTag}
          {seatedIdentity}
        </>
      ) : (
        <>
          {seatedIdentity}
          {cardsBlock}
        </>
      )}
    </View>
  );
}

function RotatedSeatLayout({
  degrees,
  children,
}: {
  degrees: number;
  children: ReactNode;
}) {
  const [box, setBox] = useState({ w: 112, h: 48 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  return (
    <View style={[styles.rotatedSlot, { width: box.h, height: box.w }]}>
      <View onLayout={onLayout} style={{ transform: [{ rotate: `${degrees}deg` }] }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: 'center',
    gap: 2,
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  identity: {
    alignItems: 'center',
    gap: 2,
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
  rotatedSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  cardsBlock: {
    alignItems: 'center',
    gap: 4,
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
