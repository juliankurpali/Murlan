import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function FeltCloth() {
  return (
    <View pointerEvents="none" style={styles.stage}>
      <View style={styles.wood}>
        <LinearGradient
          colors={['#1a140e', '#2a2118', '#16110c']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fill}
        />
      </View>
      <View style={styles.felt}>
        <LinearGradient
          colors={['#1a8a58', '#0f5c3d', '#0a3d2a']}
          start={{ x: 0.5, y: 0.05 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fill}
        />
        <View style={styles.rail} />
        <View style={styles.ovalA} />
        <View style={styles.ovalB} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  wood: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  felt: {
    position: 'absolute',
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(212, 175, 55, 0.28)',
  },
  rail: {
    position: 'absolute',
    top: 7,
    right: 7,
    bottom: 7,
    left: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ovalA: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    top: '18%',
    bottom: '18%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  ovalB: {
    position: 'absolute',
    left: '28%',
    right: '28%',
    top: '28%',
    bottom: '28%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
});
