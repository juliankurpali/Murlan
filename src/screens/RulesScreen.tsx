import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { RulesConfig } from '../domain';
import { LandscapeFrame, LandscapePane } from '../components/LandscapeFrame';
import { t } from '../i18n';
import { colors, spacing } from '../theme';

type Props = {
  language: Language;
  rules: RulesConfig;
  onBack: () => void;
};

function flag(language: Language, value: boolean): string {
  return t(language, value ? 'on' : 'off');
}

export function RulesScreen({ language, rules, onBack }: Props) {
  return (
    <LandscapeFrame title={t(language, 'rulesTitle')} backLabel={t(language, 'back')} onBack={onBack}>
      <LandscapePane>
        <ScrollView contentContainerStyle={styles.copy} showsVerticalScrollIndicator={false}>
          <Text style={styles.body}>{t(language, 'rulesIntro')}</Text>
          <Text style={styles.body}>{t(language, 'rulesDetail')}</Text>
        </ScrollView>
      </LandscapePane>
      <LandscapePane>
        <ScrollView contentContainerStyle={styles.table} showsVerticalScrollIndicator={false}>
          <Text style={styles.sub}>{t(language, 'rulesActive')}</Text>
          <Row label={t(language, 'rulesFlush')} value={flag(language, rules.flushEnabled)} />
          <Row label={t(language, 'rulesFlushBomb')} value={flag(language, rules.flushBeatsBomb)} />
          <Row label={t(language, 'rulesAceLow')} value={flag(language, rules.aceLowStraightEnabled)} />
          <Row label={t(language, 'rulesAceHigh')} value={flag(language, rules.aceHighStraightEnabled)} />
          <Row
            label={t(language, 'rulesThreeSpades')}
            value={flag(language, rules.firstLeadMustContainThreeOfSpades)}
          />
          <Row label={t(language, 'rulesExchange')} value={flag(language, rules.cardExchangeEnabled)} />
          <Row label={t(language, 'rulesReentry')} value={flag(language, rules.allowReentryAfterPass)} />
          <Row label={t(language, 'rulesTarget')} value={String(rules.targetScore)} />
        </ScrollView>
      </LandscapePane>
    </LandscapeFrame>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
    paddingBottom: spacing.sm,
  },
  table: {
    gap: 2,
    paddingBottom: spacing.sm,
  },
  sub: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 4,
    minHeight: 30,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.feltLight,
  },
  rowLabel: {
    color: colors.cream,
    flex: 1,
    fontSize: 13,
  },
  rowValue: {
    color: colors.gold,
    fontWeight: '700',
  },
});
