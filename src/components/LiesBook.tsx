import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Language } from '../application/types';
import { t } from '../i18n';
import { colors, fonts, radius, spacing } from '../theme';
import { liesSheetMetrics } from './liesSheet';
import { useStageDimensions } from './WebStage';

type Props = {
  language: Language;
  visible: boolean;
  onClose: () => void;
};

export function LiesBook({ language, visible, onClose }: Props) {
  const { width, height } = useStageDimensions();
  const insets = useSafeAreaInsets();
  const sheet = liesSheetMetrics(
    width,
    height,
    Math.max(insets.left, 8),
    Math.max(insets.right, 8),
    Math.max(insets.top, 6),
    Math.max(insets.bottom, 8),
  );

  if (!visible) {
    return null;
  }

  return (
    <>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.scrim} />
      <View
        style={[
          styles.wrap,
          {
            paddingTop: Math.max(insets.top, sheet.phone ? 8 : spacing.lg),
            paddingBottom: Math.max(insets.bottom, sheet.phone ? 8 : spacing.lg),
            paddingHorizontal: Math.max(insets.left, insets.right, sheet.phone ? 10 : spacing.lg),
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.panel, { width: sheet.width, maxHeight: sheet.maxHeight }]} accessibilityViewIsModal>
          <View style={[styles.head, sheet.phone && styles.headPhone]}>
            <Text style={[styles.title, { fontSize: sheet.titleSize }]} numberOfLines={1}>
              {t(language, 'liesBookTitle')}
            </Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>{t(language, 'close')}</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={[styles.body, { padding: sheet.padding }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.intro, sheet.phone && styles.introPhone]}>{t(language, 'liesBookBody')}</Text>
          </ScrollView>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    zIndex: 40,
  },
  wrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 41,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  headPhone: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    flex: 1,
    color: colors.cream,
    fontFamily: fonts.sans,
    fontWeight: '800',
  },
  close: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  closeText: {
    color: colors.gold,
    fontFamily: fonts.sans,
    fontWeight: '600',
    fontSize: 14,
  },
  body: {
    gap: spacing.sm,
  },
  intro: {
    color: colors.cream,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  introPhone: {
    fontSize: 13,
    lineHeight: 19,
  },
});
