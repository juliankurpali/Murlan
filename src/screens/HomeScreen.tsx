import { StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { BrandMark } from '../components/BrandMark';
import { UiButton } from '../components/UiButton';
import { t } from '../i18n';
import { colors, fonts, markGutter, spacing } from '../theme';

type Props = {
  language: Language;
  canResume: boolean;
  onOnline: () => void;
  onResume: () => void;
  onRules: () => void;
  onSettings: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
};

export function HomeScreen({
  language,
  canResume,
  onOnline,
  onResume,
  onRules,
  onSettings,
  onTerms,
  onPrivacy,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.brand}>
        <BrandMark size={42} />
        <Text style={styles.title}>{t(language, 'appName')}</Text>
        <Text style={styles.tag} numberOfLines={2}>
          {t(language, 'tagline')}
        </Text>
        <Text style={styles.note} numberOfLines={2}>
          {t(language, 'freePlayNote')} {t(language, 'independentNote')}
        </Text>
      </View>
      <View style={styles.actions}>
        <UiButton label={t(language, 'playOnline')} onPress={onOnline} />
        {canResume ? (
          <UiButton label={t(language, 'resumeGame')} variant="ghost" onPress={onResume} />
        ) : null}
        <View style={styles.row}>
          <UiButton label={t(language, 'rules')} variant="ghost" onPress={onRules} style={styles.half} />
          <UiButton label={t(language, 'settings')} variant="ghost" onPress={onSettings} style={styles.half} />
        </View>
        <UiButton label={t(language, 'termsTitle')} variant="ghost" onPress={onTerms} />
        <UiButton label={t(language, 'privacyTitle')} variant="ghost" onPress={onPrivacy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.room,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.lg,
    paddingRight: spacing.md + markGutter,
    paddingVertical: spacing.md,
    gap: spacing.lg,
    minHeight: 0,
  },
  brand: {
    flex: 1.15,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 0,
    gap: 6,
  },
  note: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    maxWidth: 420,
  },
  title: {
    color: colors.gold,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 8,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  tag: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 13,
    letterSpacing: 1.2,
  },
  actions: {
    flex: 1,
    minWidth: 200,
    maxWidth: 300,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
});
