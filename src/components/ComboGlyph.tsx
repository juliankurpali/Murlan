import { StyleSheet, View } from 'react-native';
import { CombinationType } from '../domain';
import { colors } from '../theme';

type Props = {
  type: CombinationType;
};

function Mini({ gold, tilt, offset }: { gold?: boolean; tilt: string; offset: number }) {
  return (
    <View
      style={[
        styles.mini,
        gold && styles.miniGold,
        { marginLeft: offset, transform: [{ rotate: tilt }] },
      ]}
    />
  );
}

export function ComboGlyph({ type }: Props) {
  if (type === 'single') {
    return (
      <View style={styles.row}>
        <Mini tilt="-6deg" offset={0} />
      </View>
    );
  }
  if (type === 'pair') {
    return (
      <View style={styles.row}>
        <Mini tilt="-10deg" offset={0} />
        <Mini tilt="8deg" offset={-8} />
      </View>
    );
  }
  if (type === 'triple') {
    return (
      <View style={styles.row}>
        <Mini tilt="-12deg" offset={0} />
        <Mini tilt="0deg" offset={-8} />
        <Mini tilt="12deg" offset={-8} />
      </View>
    );
  }
  if (type === 'bomb') {
    return (
      <View style={styles.burst}>
        <View style={styles.burstRing} />
        <View style={styles.burstCore} />
        <View style={[styles.ray, styles.rayN]} />
        <View style={[styles.ray, styles.rayE]} />
        <View style={[styles.ray, styles.rayNE]} />
        <View style={[styles.ray, styles.raySE]} />
      </View>
    );
  }
  if (type === 'flush') {
    return (
      <View style={styles.row}>
        <Mini gold tilt="-16deg" offset={0} />
        <Mini gold tilt="-8deg" offset={-7} />
        <Mini gold tilt="0deg" offset={-7} />
        <Mini gold tilt="8deg" offset={-7} />
        <Mini gold tilt="16deg" offset={-7} />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Mini gold tilt="-14deg" offset={0} />
      <Mini gold tilt="-4deg" offset={-6} />
      <Mini gold tilt="6deg" offset={-6} />
      <Mini gold tilt="16deg" offset={-6} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    height: 18,
  },
  mini: {
    width: 11,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)',
  },
  miniGold: {
    backgroundColor: colors.gold,
    borderColor: '#F8E7B0',
  },
  burst: {
    width: 30,
    height: 30,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstRing: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  burstCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  ray: {
    position: 'absolute',
    width: 3,
    height: 13,
    backgroundColor: colors.gold,
    borderRadius: 1,
  },
  rayN: {
    top: 0,
  },
  rayE: {
    transform: [{ rotate: '90deg' }],
  },
  rayNE: {
    transform: [{ rotate: '45deg' }],
  },
  raySE: {
    transform: [{ rotate: '135deg' }],
  },
});
