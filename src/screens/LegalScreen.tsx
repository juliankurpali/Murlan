import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { LandscapeFrame } from '../components/LandscapeFrame';
import { t } from '../i18n';
import { legalDoc, LegalKind } from '../legal';
import { colors, spacing } from '../theme';

type Props = {
  language: Language;
  kind: LegalKind;
  onBack: () => void;
  onSwitch?: (kind: LegalKind) => void;
};

export function LegalScreen({ language, kind, onBack, onSwitch }: Props) {
  const doc = legalDoc(language, kind);
  return (
    <LandscapeFrame title={doc.title} backLabel={t(language, 'back')} onBack={onBack}>
      <View style={styles.body}>
        {onSwitch ? (
          <View style={styles.tabs}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSwitch('terms')}
              style={[styles.tab, kind === 'terms' && styles.tabOn]}
            >
              <Text style={[styles.tabText, kind === 'terms' && styles.tabTextOn]}>
                {t(language, 'termsTitle')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSwitch('privacy')}
              style={[styles.tab, kind === 'privacy' && styles.tabOn]}
            >
              <Text style={[styles.tabText, kind === 'privacy' && styles.tabTextOn]}>
                {t(language, 'privacyTitle')}
              </Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.updated}>{t(language, 'legalUpdated', { date: doc.updated })}</Text>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator>
          {doc.sections.map((section) => (
            <View key={section.heading} style={styles.block}>
              <Text style={styles.heading}>{section.heading}</Text>
              <Text style={styles.copy}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </LandscapeFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
  },
  tabOn: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  tabText: {
    color: colors.cream,
    fontWeight: '700',
  },
  tabTextOn: {
    color: colors.ink,
  },
  updated: {
    color: colors.muted,
    fontSize: 12,
  },
  scroll: {
    gap: spacing.md,
    paddingRight: spacing.md,
    paddingBottom: spacing.lg,
  },
  block: {
    gap: 6,
  },
  heading: {
    color: colors.goldHi,
    fontWeight: '800',
    fontSize: 15,
  },
  copy: {
    color: colors.cream,
    fontSize: 14,
    lineHeight: 21,
  },
});
