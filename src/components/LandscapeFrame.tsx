import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UiButton } from './UiButton';
import { colors, fonts, markGutter, spacing } from '../theme';

type Props = {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  action?: ReactNode;
  children: ReactNode;
};

export function LandscapeFrame({ title, backLabel, onBack, action, children }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.side}>
          {onBack && backLabel ? (
            <UiButton label={backLabel} variant="ghost" onPress={onBack} />
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.side, styles.sideRight]}>{action}</View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

export function LandscapePane({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <View style={[styles.pane, wide && styles.paneWide]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.room,
    paddingLeft: spacing.md,
    paddingRight: spacing.md + markGutter,
    paddingVertical: spacing.sm,
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 4,
    gap: spacing.sm,
  },
  side: {
    flex: 1,
    minWidth: 88,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  title: {
    flexShrink: 1,
    maxWidth: '42%',
    color: colors.goldHi,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    fontFamily: fonts.sans,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    minHeight: 0,
  },
  pane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  paneWide: {
    flex: 1.25,
  },
});
