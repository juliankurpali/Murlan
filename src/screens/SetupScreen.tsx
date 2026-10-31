import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { LandscapeFrame, LandscapePane } from '../components/LandscapeFrame';
import { UiButton } from '../components/UiButton';
import { t } from '../i18n';
import { colors, fonts, radius, spacing } from '../theme';

type Props = {
  language: Language;
  onBack: () => void;
  onStart: (language: Language) => void;
};

export function SetupScreen({ language, onBack, onStart }: Props) {
  const [lang, setLang] = useState<Language>(language);

  return (
    <LandscapeFrame title={t(lang, 'newGame')} backLabel={t(lang, 'back')} onBack={onBack}>
      <LandscapePane wide>
        <View style={styles.hero}>
          <Text style={styles.title}>{t(lang, 'mode2v2')}</Text>
          <Text style={styles.hint}>{t(lang, 'mode2v2Hint')}</Text>
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
          <UiButton label={t(lang, 'start')} onPress={() => onStart(lang)} />
        </View>
      </LandscapePane>
    </LandscapeFrame>
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
  hero: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(232, 197, 71, 0.12)',
  },
  title: {
    color: colors.goldHi,
    fontWeight: '800',
    fontSize: 22,
    fontFamily: fonts.sans,
  },
  hint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
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
