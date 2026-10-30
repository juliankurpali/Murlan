import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Language } from '../application/types';
import { t } from '../i18n';
import { colors, fonts, spacing } from '../theme';
import { isTouchWeb } from '../webSupport';

const touch = isTouchWeb();

export function RotateHint({ language }: { language: Language }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || !touch || height <= width) {
    return null;
  }
  return (
    <View style={styles.cover}>
      <Text style={styles.icon}>⟲</Text>
      <Text style={styles.text}>{t(language, 'rotatePhone')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    backgroundColor: colors.room,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  icon: {
    color: colors.gold,
    fontSize: 56,
  },
  text: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
});
