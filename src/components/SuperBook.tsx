import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { SUPER_MURLAN } from '../domain';
import { MessageKey, t } from '../i18n';
import { colors, fonts, radius, spacing } from '../theme';

const PLACE_KEYS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;

const FACTS: { value: string; label: MessageKey }[] = [
  { value: String(SUPER_MURLAN.maxPlayers), label: 'superBookPlayers' },
  { value: String(SUPER_MURLAN.teamCount), label: 'superBookTeams' },
  { value: String(SUPER_MURLAN.cardsPerPlayer), label: 'superBookHand' },
  { value: String(SUPER_MURLAN.undealtCards), label: 'superBookUndealt' },
  { value: String(SUPER_MURLAN.totalCards), label: 'superBookDeck' },
  { value: '4', label: 'superBookJokers' },
];

const TEAMS = [
  { id: 1, color: colors.team1, key: 'team1' as const },
  { id: 2, color: colors.team2, key: 'team2' as const },
  { id: 3, color: colors.team3, key: 'team3' as const },
];

const WIN_STEPS: MessageKey[] = ['superBookWin1', 'superBookWin2', 'superBookWin3'];

type Props = {
  language: Language;
  visible: boolean;
  onClose: () => void;
};

export function SuperBook({ language, visible, onClose }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(language, 'superBookClose')}
        onPress={onClose}
        style={styles.scrim}
      />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.panel} accessibilityViewIsModal>
          <View style={styles.head}>
            <View style={styles.headCopy}>
              <Text style={styles.kicker}>{t(language, 'superBookKicker')}</Text>
              <Text style={styles.title}>{t(language, 'superBookTitle')}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>{t(language, 'close')}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.intro}>{t(language, 'superBookIntro')}</Text>

            <View style={styles.facts}>
              {FACTS.map((fact) => (
                <View key={fact.label} style={styles.fact}>
                  <Text style={styles.factValue}>{fact.value}</Text>
                  <Text style={styles.factLabel}>{t(language, fact.label)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.columns}>
              <Section title={t(language, 'superBookPartners')}>
                <View style={styles.teams}>
                  {TEAMS.map((team) => (
                    <View key={team.id} style={[styles.teamChip, { borderColor: team.color }]}>
                      <View style={[styles.teamDot, { backgroundColor: team.color }]} />
                      <Text style={[styles.teamName, { color: team.color }]}>{t(language, team.key)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.bodyText}>{t(language, 'superBookPartnersBody')}</Text>
              </Section>

              <Section title={t(language, 'superBookPlay')}>
                <Text style={styles.bodyText}>{t(language, 'superBookPlayBody')}</Text>
              </Section>
            </View>

            <View style={styles.columns}>
              <Section title={t(language, 'superBookPlaces')}>
                <Text style={styles.hint}>{t(language, 'superBookPlacesHint')}</Text>
                <View style={styles.placeTable}>
                  {PLACE_KEYS.map((place, index) => (
                    <View key={place} style={[styles.placeRow, index % 2 === 1 && styles.placeAlt]}>
                      <Text style={styles.placeRank}>{t(language, place)}</Text>
                      <Text style={styles.placePts}>{SUPER_MURLAN.pointsByFinishOrder[index]}</Text>
                    </View>
                  ))}
                </View>
              </Section>

              <Section title={t(language, 'superBookWin')}>
                {WIN_STEPS.map((key, index) => (
                  <View key={key} style={styles.step}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{t(language, key)}</Text>
                  </View>
                ))}
              </Section>
            </View>

            <Section title={t(language, 'superBookExample')}>
              <View style={styles.example}>
                <ExampleLine color={colors.team1} team={t(language, 'team1')} detail="15 + 3" total="18" />
                <ExampleLine color={colors.team2} team={t(language, 'team2')} detail="12 + 9" total="21" win />
                <ExampleLine color={colors.team3} team={t(language, 'team3')} detail="6 + 1" total="7" />
              </View>
              <Text style={styles.hint}>{t(language, 'superBookExampleHint')}</Text>
            </Section>
          </ScrollView>
        </View>
      </View>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ExampleLine({
  color,
  team,
  detail,
  total,
  win = false,
}: {
  color: string;
  team: string;
  detail: string;
  total: string;
  win?: boolean;
}) {
  return (
    <View style={[styles.exampleRow, win && styles.exampleWin]}>
      <View style={[styles.teamDot, { backgroundColor: color }]} />
      <Text style={styles.exampleTeam}>{team}</Text>
      <Text style={styles.exampleDetail}>{detail}</Text>
      <Text style={[styles.exampleTotal, win && { color }]}>{total}</Text>
    </View>
  );
}

const PAGE = '#f4efe4';
const INK = '#1c1812';
const MUTED = '#6d6458';

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(4, 8, 10, 0.78)',
    zIndex: 20,
  },
  wrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 21,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  panel: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '100%',
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 197, 71, 0.55)',
    backgroundColor: PAGE,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: '#0f1a16',
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  title: {
    color: colors.goldHi,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  close: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    padding: spacing.md,
    gap: 12,
    paddingBottom: spacing.lg,
  },
  intro: {
    color: INK,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fact: {
    flexGrow: 1,
    flexBasis: 104,
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#ebe4d4',
    borderWidth: 1,
    borderColor: 'rgba(28, 24, 18, 0.08)',
  },
  factValue: {
    color: colors.feltDark,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    fontFamily: fonts.sans,
  },
  factLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: fonts.sans,
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  section: {
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 240,
    gap: 8,
  },
  sectionTitle: {
    color: colors.feltDark,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  bodyText: {
    color: INK,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.sans,
  },
  hint: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.sans,
  },
  teams: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  teamChip: {
    flexGrow: 1,
    flexBasis: 88,
    minWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#fffdf8',
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teamName: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  placeTable: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(28, 24, 18, 0.1)',
    backgroundColor: '#fffdf8',
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  placeAlt: {
    backgroundColor: '#efe8d8',
  },
  placeRank: {
    color: INK,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  placePts: {
    color: colors.feltDark,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    fontFamily: fonts.sans,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.feltDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    color: colors.goldHi,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  stepText: {
    flex: 1,
    color: INK,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  example: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(28, 24, 18, 0.1)',
    backgroundColor: '#fffdf8',
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  exampleWin: {
    backgroundColor: 'rgba(224, 91, 76, 0.1)',
  },
  exampleTeam: {
    flex: 1,
    color: INK,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.sans,
  },
  exampleDetail: {
    color: MUTED,
    fontSize: 13,
    fontFamily: fonts.sans,
  },
  exampleTotal: {
    minWidth: 28,
    textAlign: 'right',
    color: INK,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    fontFamily: fonts.sans,
  },
});
