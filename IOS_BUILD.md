# Building Free Throw for iOS (App Store)

This app is wrapped with **Capacitor** so the same web codebase runs as a native iOS app. You only need to do this on a **Mac** with **Xcode** installed.

## Prerequisites
- macOS with **Xcode 15+**
- **Apple Developer account** ($99/year) — required to publish
- **Node + Bun** installed
- **CocoaPods**: `sudo gem install cocoapods`
- A **Firebase project** (free) for push notifications

## One-time setup (after cloning the repo to your Mac)

```bash
bun install
bunx cap add ios
```

This creates an `ios/` folder.

## Push notifications (FCM + APNs)

1. In the [Firebase Console](https://console.firebase.google.com): create a project → add an iOS app using bundle ID `app.lovable.c9bd69d36c494f3b98ac1695c2d8c121`.
2. Download `GoogleService-Info.plist` and drag it into `ios/App/App/` in Xcode (check "Copy if needed").
3. In [Apple Developer](https://developer.apple.com/account/resources/authkeys/list): create an **APNs Auth Key (.p8)**. Note the Key ID + Team ID.
4. In Firebase → Project Settings → Cloud Messaging → upload that `.p8`, Key ID, and Team ID.
5. In Xcode: select the **App** target → **Signing & Capabilities** → **+ Capability** → add **Push Notifications** and **Background Modes** (check "Remote notifications").

When a user signs in on the device, the app asks for push permission and saves their APNs/FCM token to the `device_tokens` table. To send a push, your backend reads that table and posts to FCM with the user's token.

## Camera (native Snapchat/TikTok-style preview)

The app uses `@capacitor-community/camera-preview` so recordings use the real iPhone camera pipeline (full resolution, smooth, correct aspect ratio) instead of the laggy web `getUserMedia` fallback.

Add to `ios/App/App/Info.plist` (Xcode → right-click Info.plist → Open As Source Code) inside the top-level `<dict>`:

```xml
<key>NSCameraUsageDescription</key>
<string>Free Throw uses the camera to record your challenge attempts.</string>
<key>NSMicrophoneUsageDescription</key>
<string>Free Throw records audio with your challenge video.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Free Throw saves your challenge videos to your photo library.</string>
```

The native camera renders BEHIND the WebView. The recorder screen's background is automatically set to transparent while active — no extra Xcode setup needed. On the web, it falls back to the existing `MediaRecorder` implementation automatically.


## Dev loop (live reload on a real iPhone)

```bash
bun run build       # optional; capacitor.config.ts points at the live preview URL
bunx cap sync ios
bunx cap open ios   # opens Xcode
```

In Xcode: plug in your iPhone → select it as the run target → press **Play**. The app loads the live Lovable preview, so any change you ship updates instantly.

## Building for App Store submission

1. Open `capacitor.config.ts` and **delete the entire `server` block**. This makes the app load the bundled `dist/` build instead of fetching the preview URL.
2. Rebuild and sync:
   ```bash
   bun run build
   bunx cap sync ios
   bunx cap open ios
   ```
3. In Xcode: **Product → Archive** → **Distribute App → App Store Connect**.
4. In [App Store Connect](https://appstoreconnect.apple.com): create the app listing, upload screenshots, fill out App Privacy (camera + push), submit for review.

Apple review typically takes 1–3 days.

## Pulling new code

After any change to the web app:
```bash
git pull
bun install
bunx cap sync ios
```
