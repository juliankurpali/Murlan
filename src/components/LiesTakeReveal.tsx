import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Language } from '../application/types';
import { LiesPileReveal, SeatId, rankLabel } from '../domain';
import { t } from '../i18n';
import { colors, fonts, motion, radius } from '../theme';
import { CardFace } from './CardFace';
import { liesSheetMetrics } from './liesSheet';
import { UiButton } from './UiButton';
import { useStageDimensions } from './WebStage';

type Props = {
  language: Language;
  reveal: LiesPileReveal;
  localSeat: SeatId;
  seatNames: string[];
  tableSize: TableSizeLike | null;
  seatCount: number;
  onDone: () => void;
};

type TableSizeLike = { width: number; height: number };

export function LiesTakeReveal({
  language,
  reveal,
  localSeat,
  seatNames,
  onDone,
}: Props) {
  const { width, height } = useStageDimensions();
  const insets = useSafeAreaInsets();
  const sheet = liesSheetMetrics(
    width,
    height,
    Math.max(insets.left, 8),
    Math.max(insets.right, 8),
    Math.max(insets.top, 6),
    Math.max(insets.bottom, 8),
  );
  const youTook = reveal.takenBy === localSeat;
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const closingRef = useRef(false);
  const [open, setOpen] = useState(true);
  const ENTER_MS = 240;
  const HOLD_MS = 3000;

  const takenName =
    reveal.takenBy === localSeat ? t(language, 'you') : (seatNames[reveal.takenBy] ?? `P${reveal.takenBy + 1}`);
  const claimName =
    reveal.claimSeat === localSeat ? t(language, 'you') : (seatNames[reveal.claimSeat] ?? `P${reveal.claimSeat + 1}`);

  const verdict = reveal.truthful
    ? t(language, 'liesRevealTrueShort')
    : t(language, 'liesRevealFalseShort');
  const title = reveal.truthful
    ? t(language, 'liesRevealTrue')
    : t(language, 'liesRevealFalse');
  const takenCount = reveal.takenCount ?? reveal.pileCards.length;
  const subtitle = youTook
    ? t(language, 'liesYouTookPile', { count: takenCount })
    : t(language, 'liesTheyTookPile', { name: takenName, count: takenCount });

  const finishClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: motion.nativeDriver,
      }),
      Animated.timing(rise, {
        toValue: -10,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: motion.nativeDriver,
      }),
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: motion.nativeDriver,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setOpen(false);
        doneRef.current();
      } else {
        closingRef.current = false;
      }
    });
  };

  useEffect(() => {
    closingRef.current = false;
    setOpen(true);
    opacity.setValue(0);
    rise.setValue(16);
    scale.setValue(0.94);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: motion.nativeDriver,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: motion.nativeDriver,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: motion.nativeDriver,
      }),
    ]).start();

    // Stay open for 3s after the enter animation, then close.
    const hold = setTimeout(() => finishClose(), ENTER_MS + HOLD_MS);
    return () => {
      clearTimeout(hold);
    };
    // Only re-run when a new reveal arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal.at]);

  const lastIds = new Set(reveal.lastBatch.map((card) => card.id));
  const showFullPile = youTook && reveal.pileCards.length > 0;
  const cardsMaxH = Math.max(
    sheet.cardH + 16,
    Math.min(sheet.maxHeight * (showFullPile ? 0.28 : 0.36), showFullPile ? sheet.cardH * 2 + 40 : sheet.cardH + 24),
  );

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={finishClose}>
      <Pressable
        style={[
          styles.scrim,
          {
            paddingTop: Math.max(insets.top, sheet.phone ? 10 : 16),
            paddingBottom: Math.max(insets.bottom, sheet.phone ? 10 : 16),
            paddingLeft: Math.max(insets.left, sheet.phone ? 12 : 20),
            paddingRight: Math.max(insets.right, sheet.phone ? 12 : 20),
          },
        ]}
        onPress={finishClose}
      >
        <Animated.View style={[styles.scrimFade, { opacity }]} pointerEvents="none" />
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={[
            styles.panelWrap,
            {
              width: sheet.width,
              maxHeight: sheet.maxHeight,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.panel,
              {
                padding: sheet.padding,
                gap: sheet.gap,
                opacity,
                transform: [{ translateY: rise }, { scale }],
              },
            ]}
          >
            <View style={[styles.verdict, reveal.truthful ? styles.verdictTrue : styles.verdictLie]}>
              <Text style={styles.verdictText}>{verdict}</Text>
            </View>
            <Text style={[styles.title, { fontSize: sheet.titleSize }]} numberOfLines={sheet.phone ? 2 : 3}>
              {title}
            </Text>
            <Text style={[styles.sub, { fontSize: sheet.hintSize }]} numberOfLines={2}>
              {subtitle}
            </Text>
            <Text style={styles.section} numberOfLines={2}>
              {t(language, 'liesLastPlayedBatch', {
                name: claimName,
                rank: rankLabel(reveal.claimedRank),
                count: reveal.claimedCount,
              })}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.row, { minHeight: sheet.cardH + 6 }]}
              style={{ maxHeight: sheet.cardH + 16, minHeight: sheet.cardH + 8, flexGrow: 0 }}
            >
              {reveal.lastBatch.map((card) => (
                <CardFace
                  key={`batch-${card.id}`}
                  card={card}
                  language={language}
                  width={sheet.cardW}
                  height={sheet.cardH}
                  highlighted
                  disabled
                  sharedLayout={false}
                />
              ))}
            </ScrollView>
            {showFullPile ? (
              <>
                <Text style={styles.section}>{t(language, 'liesAllTakenCards', { count: takenCount })}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.row, { minHeight: sheet.cardH + 6 }]}
                  style={{
                    maxHeight: Math.max(cardsMaxH, sheet.cardH + 16),
                    minHeight: sheet.cardH + 8,
                    flexGrow: 0,
                  }}
                >
                  {reveal.pileCards.map((card) => (
                    <CardFace
                      key={`pile-${card.id}`}
                      card={card}
                      language={language}
                      width={sheet.cardW}
                      height={sheet.cardH}
                      highlighted={lastIds.has(card.id)}
                      disabled
                      sharedLayout={false}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}
            <UiButton
              label={t(language, 'close')}
              variant="secondary"
              onPress={finishClose}
              style={styles.closeBtn}
            />
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrimFade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
  },
  panelWrap: {
    alignSelf: 'center',
    zIndex: 2,
  },
  panel: {
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'visible',
  },
  closeBtn: {
    alignSelf: 'stretch',
    minHeight: 40,
    marginTop: 4,
  },
  verdict: {
    alignSelf: 'center',
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  verdictTrue: {
    backgroundColor: 'rgba(46, 160, 110, 0.22)',
    borderColor: 'rgba(110, 220, 170, 0.55)',
  },
  verdictLie: {
    backgroundColor: 'rgba(224, 91, 76, 0.22)',
    borderColor: 'rgba(232, 140, 120, 0.55)',
  },
  verdictText: {
    color: colors.cream,
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.cream,
    fontFamily: fonts.sans,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontWeight: '700',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    alignItems: 'center',
  },
});
