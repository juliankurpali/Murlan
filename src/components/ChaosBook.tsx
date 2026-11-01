import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { ChaosAbilityId } from '../domain';
import { t } from '../i18n';
import { colors, fonts, radius, spacing } from '../theme';
import { AbilityMark, ABILITY_GLYPH } from './AbilityMark';
import {
  CHAOS_ABILITY_DETAIL,
  CHAOS_ABILITY_KIND,
  CHAOS_ABILITY_NAME,
  CHAOS_ABILITY_ORDER,
  CHAOS_ABILITY_RARITY,
} from './chaosAbilities';

type Props = {
  language: Language;
  visible: boolean;
  onClose: () => void;
  ownAbilityId?: ChaosAbilityId | null;
};

export function ChaosBook({ language, visible, onClose, ownAbilityId = null }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(language, 'chaosBookClose')}
        onPress={onClose}
        style={styles.scrim}
      />
      <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.panel} accessibilityViewIsModal>
        <View style={styles.head}>
          <Text style={styles.title}>{t(language, 'chaosBookTitle')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>{t(language, 'close')}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>{t(language, 'chaosBookIntro')}</Text>
          {ownAbilityId ? (
            <>
              <Text style={styles.section}>{t(language, 'chaosBookYours')}</Text>
              <RoleCard language={language} id={ownAbilityId} yours />
            </>
          ) : null}
          <Text style={styles.section}>{t(language, 'chaosBookAll')}</Text>
          <View style={styles.grid}>
            {CHAOS_ABILITY_ORDER.map((id) => (
              <RoleCard key={id} language={language} id={id} yours={id === ownAbilityId} />
            ))}
          </View>
        </ScrollView>
      </View>
      </View>
    </>
  );
}

function RoleCard({
  language,
  id,
  yours = false,
}: {
  language: Language;
  id: ChaosAbilityId;
  yours?: boolean;
}) {
  return (
    <View style={[styles.card, yours && styles.cardYours]}>
      <View style={styles.cardHead}>
        <AbilityMark glyph={ABILITY_GLYPH[id]} />
        <View style={styles.cardTitles}>
          <Text style={styles.name}>{t(language, CHAOS_ABILITY_NAME[id])}</Text>
          <Text style={styles.meta}>
            {t(language, CHAOS_ABILITY_KIND[id])}
            {'  ·  '}
            {t(language, CHAOS_ABILITY_RARITY[id])}
          </Text>
        </View>
        {yours ? <Text style={styles.yoursTag}>{t(language, 'you')}</Text> : null}
      </View>
      <Text style={styles.detail}>{t(language, CHAOS_ABILITY_DETAIL[id])}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(4, 8, 10, 0.72)',
    zIndex: 20,
  },
  wrap: {
    ...StyleSheet.absoluteFill,
    zIndex: 21,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '100%',
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.38)',
    backgroundColor: 'rgba(8, 16, 18, 0.97)',
    zIndex: 21,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 197, 71, 0.18)',
  },
  title: {
    color: colors.goldHi,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.sans,
    letterSpacing: 0.4,
  },
  close: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  closeText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    padding: spacing.md,
    gap: 8,
    paddingBottom: spacing.lg,
  },
  intro: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.sans,
  },
  section: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 240,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 6,
  },
  cardYours: {
    borderColor: colors.goldHi,
    backgroundColor: 'rgba(232, 197, 71, 0.1)',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitles: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.cream,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  meta: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  yoursTag: {
    color: colors.goldHi,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  detail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.sans,
  },
});
