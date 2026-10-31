import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { t } from '../i18n';
import { colors, radius, spacing } from '../theme';
import { UiButton } from './UiButton';

type Props = {
  language: Language;
  onLanguage: (language: Language) => void;
  onAccept: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
};

function Check({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={onToggle} style={styles.checkRow}>
      <View style={[styles.box, value && styles.boxOn]} />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export function TermsGate({ language, onLanguage, onAccept, onOpenTerms, onOpenPrivacy }: Props) {
  const [age, setAge] = useState(false);
  const [agree, setAgree] = useState(false);
  return (
    <View style={styles.overlay}>
      <View accessibilityRole="alert" style={styles.card}>
        <Text style={styles.title}>{t(language, 'termsGateTitle')}</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner} showsVerticalScrollIndicator>
          <Text style={styles.body}>{t(language, 'termsGateBody')}</Text>
          <View style={styles.links}>
            <UiButton label={t(language, 'termsTitle')} variant="ghost" onPress={onOpenTerms} />
            <UiButton label={t(language, 'privacyTitle')} variant="ghost" onPress={onOpenPrivacy} />
          </View>
          <View style={styles.lang}>
            {(['en', 'sq'] as Language[]).map((code) => (
              <Pressable
                key={code}
                accessibilityRole="button"
                accessibilityState={{ selected: language === code }}
                onPress={() => onLanguage(code)}
                style={[styles.langBtn, language === code && styles.langOn]}
              >
                <Text style={[styles.langText, language === code && styles.langTextOn]}>
                  {t(language, code === 'en' ? 'english' : 'albanian')}
                </Text>
              </Pressable>
            ))}
          </View>
          <Check label={t(language, 'termsAge')} value={age} onToggle={() => setAge((value) => !value)} />
          <Check label={t(language, 'termsAgree')} value={agree} onToggle={() => setAgree((value) => !value)} />
        </ScrollView>
        <UiButton label={t(language, 'termsAccept')} disabled={!age || !agree} onPress={onAccept} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    zIndex: 60,
  },
  card: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '82%',
    maxWidth: 560,
    maxHeight: '92%',
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollInner: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  lang: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  langBtn: {
    paddingHorizontal: 10,
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.feltLight,
    justifyContent: 'center',
  },
  langOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  langText: {
    color: colors.ink,
    fontWeight: '700',
  },
  langTextOn: {
    color: colors.ink,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  boxOn: {
    backgroundColor: colors.gold,
    borderColor: colors.goldDark,
  },
  checkLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
  },
});
