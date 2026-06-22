import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c9bd69d36c494f3b98ac1695c2d8c121',
  appName: 'KOTH',
  webDir: 'dist/client',
  ios: {
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
