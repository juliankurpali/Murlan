import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { MatchMode } from '../domain';
import { LandscapeFrame, LandscapePane } from '../components/LandscapeFrame';
import { UiButton } from '../components/UiButton';
import { t } from '../i18n';
import { colors, fonts, radius, spacing } from '../theme';

type Props = {
  language: Language;
  onBack: () => void;
  onStart: (mode: MatchMode, language: Language) => void;
};

export function SetupScreen({ language, onBack, onStart }: Props) {
  const [mode, setMode] = useState<MatchMode>('2v2');
  const [lang, setLang] = useState<Language>(language);

  return (
    <LandscapeFrame title={t(lang, 'newGame')} backLabel={t(lang, 'back')} onBack={onBack}>
      <LandscapePane wide>
        <View style={styles.cards}>
          <ModeCard
            title={t(lang, 'mode2v2')}
            hint={t(lang, 'mode2v2Hint')}
            selected={mode === '2v2'}
            onPress={() => setMode('2v2')}
            pair
          />
          <ModeCard
            title={t(lang, 'modeIndividual')}
            hint={t(lang, 'modeIndividualHint')}
            selected={mode === 'individual'}
            onPress={() => setMode('individual')}
          />
        </View>
      </LandscapePane>
      <LandscapePane>
        <View style={styles.side}>
          <Text style={styles.label}>{t(lang, 'language')}</Text>
          <View style={styles.row}>
            <Choice label={t(lang, 'english')} selected={lang === 'en'} onPress={() => setLang('en')} />
            <Choice label={t(lang, 'albanian')} selected={lang === 'sq'} onPress={() => setLang('sq')} />
          </View>
          <View style={styles.spacer} />
          <UiButton label={t(lang, 'start')} onPress={() => onStart(mode, lang)} />
        </View>
      </LandscapePane>
    </LandscapeFrame>
  );
}

function PeopleIcon({ pair }: { pair?: boolean }) {
  return (
    <View style={styles.people}>
      <View style={styles.head} />
      <View style={styles.body} />
      {pair ? (
        <>
          <View style={[styles.head, styles.headB]} />
          <View style={[styles.body, styles.bodyB]} />
        </>
      ) : null}
    </View>
  );
}

function ModeCard({
  title,
  hint,
  selected,
  onPress,
  pair,
}: {
  title: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
  pair?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.cardOn]}
    >
      <PeopleIcon pair={pair} />
      <Text style={[styles.cardTitle, selected && styles.cardTitleOn]}>{title}</Text>
      <Text style={styles.cardHint}>{hint}</Text>
    </Pressable>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceOn]}
    >
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cards: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 0,
  },
  card: {
    flex: 1,
    minHeight: 0,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(12, 28, 24, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cardOn: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(232, 197, 71, 0.12)',
  },
  cardTitle: {
    color: colors.cream,
    fontWeight: '800',
    fontSize: 16,
    fontFamily: fonts.sans,
  },
  cardTitleOn: {
    color: colors.goldHi,
  },
  cardHint: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  people: {
    width: 48,
    height: 36,
  },
  head: {
    position: 'absolute',
    left: 8,
    top: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gold,
  },
  headB: {
    left: 26,
  },
  body: {
    position: 'absolute',
    left: 4,
    top: 14,
    width: 20,
    height: 16,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: colors.gold,
  },
  bodyB: {
    left: 22,
  },
  side: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 0,
  },
  label: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  spacer: {
    flex: 1,
    minHeight: 8,
  },
  choice: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  choiceLabel: {
    color: colors.cream,
    fontWeight: '700',
  },
  choiceLabelOn: {
    color: colors.ink,
  },
});
