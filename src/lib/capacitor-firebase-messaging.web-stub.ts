// Web stub for @capacitor-firebase/messaging. The real plugin is native-only;
// on web we never call it (guarded by Capacitor.isNativePlatform()). Aliased
// in vite.config.ts to prevent Rollup from resolving the plugin's optional
// firebase/messaging peer dep.
export const FirebaseMessaging = {
  checkPermissions: async () => ({ receive: "denied" as const }),
  requestPermissions: async () => ({ receive: "denied" as const }),
  getToken: async () => ({ token: "" }),
  addListener: async () => ({ remove: () => {} }),
};
