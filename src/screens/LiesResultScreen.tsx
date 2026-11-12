import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { LandscapeFrame, LandscapePane } from '../components/LandscapeFrame';
import { isPhoneViewport } from '../components/tableLayout';
import { UiButton } from '../components/UiButton';
import { WinnerCrown, WinFireworks } from '../components/WinFireworks';
import { useStageDimensions } from '../components/WebStage';
import { PublicLiesView, SeatId } from '../domain';
import { t } from '../i18n';
import { colors, fonts, radius, spacing } from '../theme';

type SeatInfo = {
  name: string;
  isYou: boolean;
};

type Props = {
  language: Language;
  view: PublicLiesView;
  localSeat: SeatId;
  seats: SeatInfo[];
  playAgainReady: boolean;
  waitingFor: string | null;
  onPlayAgain: () => void;
  onMenu: () => void;
};

const PLACE_KEYS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;

export function LiesResultScreen({
  language,
  view,
  localSeat,
  seats,
  playAgainReady,
  waitingFor,
  onPlayAgain,
  onMenu,
}: Props) {
  const { width, height } = useStageDimensions();
  const phone = isPhoneViewport(width, height);
  const winnerSeat = view.finishOrder[0];
  const youWon = winnerSeat === localSeat;
  const winnerName =
    winnerSeat === undefined
      ? null
      : winnerSeat === localSeat
        ? t(language, 'you')
        : (seats[winnerSeat]?.name ?? `P${winnerSeat + 1}`);

  const headline =
    winnerSeat === undefined
      ? t(language, 'matchOver')
      : youWon
        ? t(language, 'winnerYou')
        : t(language, 'winnerBot', { name: winnerName ?? '' });

  return (
    <LandscapeFrame title={t(language, 'matchOver')} backLabel={t(language, 'backToMenu')} onBack={onMenu}>
      <LandscapePane>
        <View style={styles.page}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, phone && styles.scrollContentPhone]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={[styles.card, phone && styles.cardPhone]}>
              <View style={[styles.hero, phone && styles.heroPhone]}>
                {youWon ? (
                  <WinFireworks burstKey={`lies-win-${view.finishOrder.join('-')}`} accent={colors.gold} />
                ) : null}
                {youWon && !phone ? <WinnerCrown /> : null}
                <Text
                  style={[styles.headline, phone && styles.headlinePhone]}
                  numberOfLines={2}
                >
                  {headline}
                </Text>
                <Text style={[styles.sub, phone && styles.subPhone]} numberOfLines={2}>
                  {winnerName && !youWon
                    ? t(language, 'liesWinnerLine', { name: winnerName })
                    : t(language, 'liesPlayAgainPrompt')}
                </Text>
              </View>

              <View style={[styles.board, phone && styles.boardPhone]}>
                {view.finishOrder.map((seat, index) => {
                  const name = seat === localSeat ? t(language, 'you') : (seats[seat]?.name ?? `P${seat + 1}`);
                  const placeKey = PLACE_KEYS[index] ?? 'last';
                  const isWinner = index === 0;
                  return (
                    <View
                      key={seat}
                      style={[styles.row, phone && styles.rowPhone, isWinner && styles.rowWinner]}
                    >
                      <Text style={[styles.place, phone && styles.placePhone, isWinner && styles.placeWinner]}>
                        {t(language, placeKey)}
                      </Text>
                      <Text
                        style={[styles.name, phone && styles.namePhone, isWinner && styles.nameWinner]}
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.actions, phone && styles.actionsPhone]}>
                <UiButton
                  label={playAgainReady ? t(language, 'youAreReady') : t(language, 'playAgain')}
                  variant="go"
                  disabled={playAgainReady}
                  onPress={onPlayAgain}
                  style={phone ? styles.btnCompact : undefined}
                />
                {waitingFor ? <Text style={styles.wait}>{waitingFor}</Text> : null}
                <UiButton
                  label={t(language, 'backToMenu')}
                  variant="ghost"
                  onPress={onMenu}
                  style={phone ? styles.btnCompact : undefined}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </LandscapePane>
    </LandscapeFrame>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  scrollContentPhone: {
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
  },
  cardPhone: {
    maxWidth: 520,
    gap: 8,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  heroPhone: {
    gap: 4,
    paddingVertical: 2,
  },
  headline: {
    color: colors.gold,
    fontFamily: fonts.sans,
    fontWeight: '800',
    fontSize: 28,
    textAlign: 'center',
  },
  headlinePhone: {
    fontSize: 20,
    lineHeight: 24,
  },
  sub: {
    color: colors.cream,
    fontFamily: fonts.sans,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
  subPhone: {
    fontSize: 12,
    lineHeight: 16,
  },
  board: {
    gap: 6,
    backgroundColor: 'rgba(8,14,18,0.55)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing.md,
  },
  boardPhone: {
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  rowPhone: {
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  rowWinner: {
    backgroundColor: 'rgba(232,197,71,0.14)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  place: {
    width: 42,
    color: colors.muted,
    fontFamily: fonts.sans,
    fontWeight: '700',
    fontSize: 13,
  },
  placePhone: {
    width: 36,
    fontSize: 11,
  },
  placeWinner: {
    color: colors.gold,
  },
  name: {
    flex: 1,
    color: colors.cream,
    fontFamily: fonts.sans,
    fontWeight: '600',
    fontSize: 15,
  },
  namePhone: {
    fontSize: 13,
  },
  nameWinner: {
    fontWeight: '800',
    color: colors.goldHi,
  },
  actions: {
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  actionsPhone: {
    gap: 6,
  },
  btnCompact: {
    minHeight: 38,
  },
  wait: {
    color: colors.muted,
    fontFamily: fonts.sans,
    fontSize: 12,
    textAlign: 'center',
  },
});
