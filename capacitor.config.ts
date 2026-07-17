import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'app.playkoth.koth',
  appName: 'Koth',
  webDir: '.output/public',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0D0D0D',
  },
  plugins: {
    PushNotifications: {
      // Empty array suppresses the system banner while the app is in the
      // foreground. Push banners only appear when backgrounded/closed; the
      // in-app notifications panel still updates in realtime.
      presentationOptions: [],
    },
  },
};
export default config;