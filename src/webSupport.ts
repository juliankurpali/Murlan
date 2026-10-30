import { Alert, Platform } from 'react-native';

// react-native-web ships Alert.alert as a no-op, which would swallow every error message.
export function installWebAlert() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  Alert.alert = (title, message) => {
    window.alert(message ? `${title}\n\n${message}` : title);
  };
}
