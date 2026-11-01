import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ChatMessage } from '../online/chat';
import { colors, fonts, motion, teamToken } from '../theme';

type Props = {
  messages: ChatMessage[];
  teamOf?: number[];
};

export function TableChatFeed({ messages, teamOf }: Props) {
  if (messages.length === 0) {
    return null;
  }
  return (
    <View style={styles.box} pointerEvents="none">
      {messages.map((line) => (
        <FadeLine
          key={line.id}
          name={line.name}
          text={line.text}
          color={teamToken(teamOf?.[line.seat] ?? line.seat % 2)}
        />
      ))}
    </View>
  );
}

function FadeLine({ name, text, color }: { name: string; text: string; color: string }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: motion.nativeDriver,
      }),
      Animated.delay(5200),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 900,
        useNativeDriver: motion.nativeDriver,
      }),
    ]);
    run.start();
    return () => run.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.line, { opacity }]}>
      <Text style={styles.row} numberOfLines={2}>
        <Text style={[styles.name, { color }]}>{name}</Text>
        <Text style={styles.text}> {text}</Text>
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(4, 8, 10, 0.58)',
  },
  line: {
    minHeight: 16,
  },
  row: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.sans,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  name: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.sans,
  },
  text: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
});
