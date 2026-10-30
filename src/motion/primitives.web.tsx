import { Pressable, ScrollView, View } from 'react-native';
import { AnimatePresence, LayoutGroup, MotionConfig, arc, motion } from 'motion/react';

export { AnimatePresence, LayoutGroup, MotionConfig };

export const MotionView = motion.create(View);
export const MotionPressable = motion.create(Pressable);
export const MotionScrollView = motion.create(ScrollView);

export const cardArc = arc({
  strength: 0.7,
  peak: 0.32,
  rotate: 0.7,
  direction: 'cw',
});

export const cardSelectTransition = {
  type: 'spring' as const,
  bounce: 0.28,
  visualDuration: 0.32,
};

export const cardFlightTransition = {
  type: 'spring' as const,
  bounce: 0.26,
  visualDuration: 0.45,
  layout: {
    type: 'spring' as const,
    bounce: 0.26,
    visualDuration: 0.45,
    path: cardArc,
  },
};

export const tapTransition = {
  type: 'spring' as const,
  bounce: 0.3,
  visualDuration: 0.2,
};
