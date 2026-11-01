import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Language } from '../application/types';
import { t } from '../i18n';
import { REACTIONS, type ReactionId } from '../reactions';
import { colors, fonts } from '../theme';

type Props = {
  language: Language;
  selected: ReactionId | null;
  onPick: (id: ReactionId) => void;
};

export function ReactionTray({ language, selected, onPick }: Props) {
  return (
    <View accessibilityRole="menu" style={styles.tray}>
      {REACTIONS.map((item) => {
        const active = selected === item.id;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={t(language, item.nameKey)}
            accessibilityState={{ selected: active }}
            onPress={() => onPick(item.id)}
            style={[styles.slot, active && styles.slotOn]}
          >
            <Text style={styles.glyph}>{item.glyph}</Text>
            <Text style={[styles.caption, active && styles.captionOn]}>{t(language, item.nameKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 228,
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(232, 197, 71, 0.4)',
    backgroundColor: 'rgba(8, 16, 18, 0.94)',
  },
  slot: {
    width: 42,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    borderRadius: 10,
  },
  slotOn: {
    backgroundColor: 'rgba(232, 197, 71, 0.18)',
  },
  glyph: {
    fontSize: 20,
  },
  caption: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontFamily: fonts.sans,
  },
  captionOn: {
    color: colors.goldHi,
  },
});
