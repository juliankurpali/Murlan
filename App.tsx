import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MatchApp } from './src/MatchApp';
import { MotionConfig } from './src/motion';
import { ensureWebFonts } from './src/theme';
import { installWebAudioUnlock } from './src/feel/webAudio';
import { installWebAlert } from './src/webSupport';

ensureWebFonts();
installWebAlert();
installWebAudioUnlock();

export default function App() {
  return (
    <SafeAreaProvider>
      <MotionConfig reducedMotion="user">
        <StatusBar style="light" />
        <MatchApp />
      </MotionConfig>
    </SafeAreaProvider>
  );
}
