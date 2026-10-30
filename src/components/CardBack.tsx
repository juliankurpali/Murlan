import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { CARD_BACK } from './cardImages';

type Size = 'xs' | 'sm';

type Props = {
  size?: Size;
  tilt?: number;
};

const DIM = {
  xs: { width: 26, height: 38 },
  sm: { width: 32, height: 46 },
};

export function CardBack({ size = 'sm', tilt = 0 }: Props) {
  const dim = DIM[size];
  return (
    <View style={[styles.card, dim, { transform: [{ rotate: `${tilt}deg` }] }]}>
      <Image source={CARD_BACK} style={styles.art} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F7F4EC',
    overflow: 'hidden',
    backgroundColor: colors.cardBack,
    shadowColor: '#041018',
    shadowOpacity: 0.42,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  art: {
    width: '100%',
    height: '100%',
  },
});
