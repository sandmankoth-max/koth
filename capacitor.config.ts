import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c9bd69d36c494f3b98ac1695c2d8c121',
  appName: 'Free Throw',
  webDir: 'dist',
  server: {
    // Loads the live preview URL so you get hot-reload while developing on device.
    // Before submitting to the App Store, remove the `server` block so the app
    // loads the bundled `dist/` build instead of fetching over the network.
    url: 'https://c9bd69d3-6c49-4f3b-98ac-1695c2d8c121.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
