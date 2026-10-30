import { createContext, ReactNode, useContext } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme';

type Stage = { width: number; height: number; scale: number };

const StageContext = createContext<Stage | null>(null);

// The table is laid out for a phone in landscape. On tablets and desktops the whole stage is
// rendered at that logical size and scaled up, so cards, seats and text keep their proportions
// instead of floating on an oversized felt.
const DESIGN_WIDTH = 900;
const DESIGN_HEIGHT = 420;
const MAX_SCALE = 3;
const MIN_ASPECT = 1.35;

export function stageFor(width: number, height: number, letterbox: boolean): Stage & { top: number } {
  const usable = letterbox ? Math.min(height, Math.round(width / MIN_ASPECT)) : height;
  const raw = Math.min(width / DESIGN_WIDTH, usable / DESIGN_HEIGHT);
  const scale = Math.max(1, Math.min(MAX_SCALE, Math.round(raw * 100) / 100));
  return {
    width: width / scale,
    height: usable / scale,
    scale,
    top: Math.max(0, Math.round((height - usable) / 2)),
  };
}

export function useStageDimensions(): Stage {
  const stage = useContext(StageContext);
  const { width, height } = useWindowDimensions();
  return stage ?? { width, height, scale: 1 };
}

// Touch devices are never letterboxed: a phone held upright gets the rotate prompt instead.
export function WebStage({ children, touch }: { children: ReactNode; touch: boolean }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }
  const stage = stageFor(width, height, !touch);
  return (
    <StageContext.Provider value={{ width: stage.width, height: stage.height, scale: stage.scale }}>
      <View style={styles.backdrop}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: stage.top,
            width: stage.width,
            height: stage.height,
            transform: [{ scale: stage.scale }],
            transformOrigin: 'top left',
          }}
        >
          {children}
        </View>
      </View>
    </StageContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.room,
    overflow: 'hidden',
  },
});
