
# KOTH — iOS Development & Build Guide

Created by Ben Sandman | 2026

KOTH (King of the Hill) is an iOS social competition app where users complete weekly challenges, record videos, compete on verified leaderboards, and interact with friends.

This document explains how the web application was adapted for iOS, the tools used, and the technical problems encountered during development.

## 1. Development Overview

KOTH began as a web application built with Lovable, using React, TypeScript, and Supabase.

Lovable generated most of the initial application code based on my specifications. I used Claude to help review prompts and troubleshoot technical issues.

To bring KOTH to the App Store, I connected the project to GitHub and used Terminal, Capacitor, and Xcode to package and configure the application for iOS.

The native application uses a WKWebView to display the React interface, with native Swift integrations for features requiring access to iPhone hardware.

## 2. Technologies

- React and TypeScript — application interface
- TanStack Start and Vite — application framework and build system
- Supabase — authentication, PostgreSQL database, and video storage
- Capacitor 8 — bridge between web and native iOS
- Swift and AVFoundation — native camera functionality
- Xcode — iOS configuration, device builds, signing, and distribution
- Apple Push Notification service (APNs) — iOS push delivery
- Firebase — limited messaging-related configuration
- GitHub — source control and project synchronization

## 3. Project Configuration

The current Capacitor configuration uses:

- App ID: `app.playkoth.koth`
- App name: `Koth`
- Web build directory: `.output/public`
- Native iOS project: `ios/App/`

The iOS project is already included in this repository.

Do not create a new iOS project with `cap add ios` when working with the existing project.

## 4. Local Build Process

### Requirements

- Mac with a compatible version of Xcode
- Node.js and npm or Bun
- Git
- Apple Developer signing access for device distribution
- Required environment configuration

### Clone the repository

```bash
git clone https://github.com/sandmankoth-max/koth.git
cd koth
```

### Install dependencies

```bash
npm install
```

Alternatively, use Bun if that is how your local development environment is configured:

```bash
bun install
```

### Build the web application

```bash
npm run build
```

The build is configured to produce the web assets used by Capacitor under `.output/public`.

### Synchronize with iOS

```bash
npx cap sync ios
```

This updates the iOS project with the latest built web assets and compatible native plugin configuration.

### Open Xcode

```bash
npx cap open ios
```

Select the existing app target, configure the appropriate development team, and choose an iPhone or simulator.

Build and run the application through Xcode.

Native camera and notification features should also be tested on a physical iPhone.

## 5. Native Camera Integration

One of the most difficult parts of developing KOTH was creating a reliable in-app recording experience on iOS.

The original web camera approach encountered multiple problems during device testing:

- The camera preview displayed a gray screen.
- Recording sometimes failed to start.
- Recorded files could not always be read.
- Camera controls overlapped with the iOS interface.
- Video orientation and camera switching required adjustments.

The project eventually incorporated a custom Swift Capacitor camera plugin using Apple's AVFoundation framework.

Relevant files include:

- `ios/App/App/KothCameraPreviewPlugin.swift`
- `ios/App/App/BridgeViewController.swift`
- `src/components/koth/native-camera-recorder.tsx`
- `src/components/koth/camera-recorder.tsx`

The native camera preview renders beneath a transparent WebView, allowing KOTH's interface to appear over the iPhone camera.

The application also retains a browser-based recording implementation for supported web environments.

This solution emerged through repeated testing, examination of device errors, and AI-assisted troubleshooting.

## 6. Native Layout and Interface

Converting the web application into an iOS app introduced layout problems that were not present in the browser.

These included:

- Content overlapping the status bar and home indicator
- Camera controls appearing outside accessible screen areas
- Navigation bars covering buttons
- Video feeds displaying incorrectly
- Scrolling and touch interactions behaving differently on iPhone
- Profile images and video thumbnails loading inconsistently

The interface was repeatedly adjusted and tested to accommodate native iPhone dimensions, safe areas, and navigation behavior.

These changes were important because KOTH relies heavily on full-screen video, smooth scrolling, and direct interaction with recorded content.

## 7. Push Notifications

KOTH includes both in-app notifications and native iOS push notifications.

The current iOS implementation uses Apple Push Notification service (APNs) for delivery.

At a high level:

1. The iOS app registers for push notifications.
2. The device token is stored through the backend.
3. Application events generate notification records.
4. Database-triggered backend logic initiates push delivery.
5. Notifications are sent through APNs to the relevant device.

Firebase-related configuration is also present in the project, including support for other messaging paths, but the current iOS delivery implementation uses APNs directly.

The native project includes push notification capabilities and related configuration.

Private authentication credentials are not included in this documentation.

## 8. Backend and Storage

KOTH uses Supabase, integrated through Lovable Cloud, for its backend infrastructure.

This supports:

- User authentication and profiles
- Weekly challenges and submissions
- Verified leaderboard results
- Video and avatar storage
- Friend relationships
- Comments and likes
- Moderation and reporting
- Notification records
- Administrative functions

Supabase storage and database permissions support the separation between public content, friends-only content, and administrative operations.

The backend made it possible to support social and competition features without building a separate database system from scratch.

## 9. Testing and Debugging

Much of KOTH's iOS development involved testing the app on an actual iPhone, identifying problems, and iterating on solutions.

The development process included:

1. Building the web application
2. Synchronizing changes through Capacitor
3. Opening and running the native project in Xcode
4. Testing features on an iPhone
5. Reviewing errors and unexpected behavior
6. Investigating solutions using documentation and AI assistance
7. Making changes and repeating the process

Testing covered camera recording, video submission, scrolling, native navigation, notifications, account functionality, and other user-facing features.

Not every problem could be identified using the web preview alone.

## 10. Preparing an iOS Release

The existing Xcode project is configured for KOTH.

A release workflow generally involves:

1. Updating the web application
2. Building the latest web assets
3. Synchronizing the Capacitor project
4. Opening the project in Xcode
5. Checking the app identifier, signing, capabilities, and version information
6. Testing the build on a physical device
7. Archiving the application in Xcode
8. Distributing the archive through App Store Connect
9. Completing Apple's required submission information

Actual signing credentials, permissions, and App Store Connect access are required to publish a release.

## 11. Updating the Native Application

After pulling updated project code:

```bash
git pull
npm install
npm run build
npx cap sync ios
npx cap open ios
```

Review any native changes before building.

Changes to the web application may require rebuilding and resynchronizing the iOS project before they appear in the packaged app.

## 12. Development Credits

KOTH was conceived, designed, and directed by Ben Sandman.

My work included product design, competition mechanics, branding, interface specifications, testing, debugging, native iOS project configuration, and App Store submission.

Lovable generated most of the application code based on my instructions and feedback. Claude and other AI-assisted workflows helped with prompt refinement and technical troubleshooting.

The iOS integration required learning and working across GitHub, Terminal, Capacitor, Xcode, and native Apple development tools.

The project demonstrates the process of taking an original web-based concept and developing it into an operational iOS application.

---

For an overview of KOTH's features and design, see the repository's main `README.md`.
