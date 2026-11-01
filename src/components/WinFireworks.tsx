import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, motion } from '../theme';

type Spark = {
  dx: number;
  dy: number;
  size: number;
  tint: 0 | 1 | 2;
  diamond?: boolean;
  wave: 0 | 1 | 2;
};

function polar(
  angleDeg: number,
  dist: number,
  size: number,
  tint: 0 | 1 | 2,
  wave: 0 | 1 | 2,
  diamond = false,
): Spark {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    dx: Math.round(Math.cos(radians) * dist),
    dy: Math.round(Math.sin(radians) * dist),
    size,
    tint,
    diamond,
    wave,
  };
}

const SPARKS: Spark[] = [
  ...[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, index) =>
    polar(angle, 26 + (index % 3) * 6, index % 3 === 0 ? 6 : 4, (index % 3) as 0 | 1 | 2, 0, index % 4 === 1),
  ),
  ...[15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345].map((angle, index) =>
    polar(angle, 40 + (index % 2) * 8, index % 2 === 0 ? 5 : 3, ((index + 1) % 3) as 0 | 1 | 2, 1, index % 3 === 0),
  ),
  ...[8, 52, 98, 142, 188, 232, 278, 322].map((angle, index) =>
    polar(angle, 18 + (index % 2) * 10, 4, (index % 3) as 0 | 1 | 2, 2, index % 2 === 0),
  ),
];

const PLAY_MS = 2400;

type Props = {
  burstKey: string;
  accent: string;
};

function sparkColor(tint: 0 | 1 | 2, accent: string): string {
  if (tint === 1) {
    return colors.gold;
  }
  if (tint === 2) {
    return accent;
  }
  return colors.goldHi;
}

export function WinnerCrown() {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.nativeDriver,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: motion.nativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.crown,
        {
          transform: [
            {
              translateY: bob.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -3],
              }),
            },
            {
              scale: bob.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.08],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.crownMark}>👑</Text>
    </Animated.View>
  );
}

export function WinFireworks({ burstKey, accent }: Props) {
  const [alive, setAlive] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setAlive(true);
    progress.setValue(0);
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: PLAY_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: motion.nativeDriver,
    });
    run.start();
    const hide = setTimeout(() => setAlive(false), PLAY_MS + 80);
    return () => {
      clearTimeout(hide);
      run.stop();
    };
  }, [burstKey, progress]);

  if (!alive) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: colors.goldHi,
            opacity: progress.interpolate({
              inputRange: [0, 0.18, 0.42],
              outputRange: [0.95, 0.5, 0],
            }),
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 0.42],
                  outputRange: [0.5, 1.85],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          styles.ringTwo,
          {
            borderColor: colors.gold,
            opacity: progress.interpolate({
              inputRange: [0, 0.2, 0.38, 0.7],
              outputRange: [0, 0, 0.75, 0],
            }),
            transform: [
              {
                scale: progress.interpolate({
                  inputRange: [0, 0.2, 0.7],
                  outputRange: [0.4, 0.4, 2.15],
                }),
              },
            ],
          },
        ]}
      />
      {SPARKS.map((spark, index) => {
        const start = 0.03 + spark.wave * 0.2 + (index % 12) * 0.012;
        const peak = Math.min(0.62, start + 0.1);
        const fade = Math.min(0.88, peak + 0.22);
        return (
          <Animated.View
            key={`${burstKey}-${index}`}
            style={[
              styles.spark,
              {
                width: spark.size,
                height: spark.size,
                borderRadius: spark.diamond ? 1 : spark.size / 2,
                backgroundColor: sparkColor(spark.tint, accent),
                opacity: progress.interpolate({
                  inputRange: [0, start, peak, fade, 1],
                  outputRange: [0, 0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, spark.dx],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, spark.dy],
                    }),
                  },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 0.16, 1],
                      outputRange: [0.3, 1.25, 0.45],
                    }),
                  },
                  { rotate: spark.diamond ? '45deg' : '0deg' },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 24,
    overflow: 'visible',
  },
  ring: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: 'rgba(232, 197, 71, 0.2)',
  },
  ringTwo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  spark: {
    position: 'absolute',
    shadowColor: colors.goldHi,
    shadowOpacity: 0.95,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  crown: {
    position: 'absolute',
    top: -13,
    zIndex: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownMark: {
    fontSize: 16,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: fonts.sans,
    textShadowColor: 'rgba(232, 197, 71, 0.95)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
