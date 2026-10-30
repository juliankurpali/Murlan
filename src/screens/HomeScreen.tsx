import { StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { UiButton } from '../components/UiButton';
import { t } from '../i18n';
import { colors, fonts, spacing } from '../theme';

type Props = {
  language: Language;
  canResume: boolean;
  fullscreenLabel?: string | null;
  onOnline: () => void;
  onResume: () => void;
  onRules: () => void;
  onSettings: () => void;
  onFullscreen?: () => void;
};

function Crown() {
  return (
    <View style={styles.crown}>
      <View style={styles.crownBand} />
      <View style={[styles.crownPeak, styles.crownPeakL]} />
      <View style={[styles.crownPeak, styles.crownPeakC]} />
      <View style={[styles.crownPeak, styles.crownPeakR]} />
    </View>
  );
}

export function HomeScreen({
  language,
  canResume,
  fullscreenLabel,
  onOnline,
  onResume,
  onRules,
  onSettings,
  onFullscreen,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.brand}>
        <Crown />
        <Text style={styles.title}>{t(language, 'appName')}</Text>
        <Text style={styles.tag}>{t(language, 'tagline')}</Text>
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
        {onFullscreen && fullscreenLabel ? (
          <UiButton label={fullscreenLabel} variant="ghost" onPress={onFullscreen} />
        ) : null}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },
  brand: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 0,
  },
  crown: {
    width: 42,
    height: 28,
    marginBottom: 8,
  },
  crownBand: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 2,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  crownPeak: {
    position: 'absolute',
    bottom: 8,
    width: 10,
    height: 16,
    backgroundColor: colors.gold,
  },
  crownPeakL: {
    left: 4,
    transform: [{ rotate: '-18deg' }],
  },
  crownPeakC: {
    left: 16,
    height: 20,
  },
  crownPeakR: {
    right: 4,
    transform: [{ rotate: '18deg' }],
  },
  title: {
    color: colors.gold,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 10,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  tag: {
    color: colors.muted,
    marginTop: 8,
    fontSize: 13,
    letterSpacing: 1.6,
  },
  actions: {
    width: 280,
    maxWidth: '46%',
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
