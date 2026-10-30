import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WebStage } from './src/components/WebStage';
import { installWebAudioUnlock } from './src/feel/webAudio';
import { MatchApp } from './src/MatchApp';
import { MotionConfig } from './src/motion';
import { ensureWebFonts } from './src/theme';
import { installWebAlert, isTouchWeb } from './src/webSupport';

ensureWebFonts();
installWebAlert();
installWebAudioUnlock();

const touch = isTouchWeb();

export default function App() {
  return (
    <SafeAreaProvider>
      <MotionConfig reducedMotion="user">
        <StatusBar style="light" />
        <WebStage touch={touch}>
          <MatchApp />
        </WebStage>
      </MotionConfig>
    </SafeAreaProvider>
  );
}
