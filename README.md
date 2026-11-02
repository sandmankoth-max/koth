# KOTH — King of the Hill

**Created by Ben Sandman | 2026**

**Website:** https://playkoth.app

## About KOTH

KOTH is an iOS social competition app I created to turn passive screen time into active participation. Every week, users compete in a new challenge by recording their attempts, submitting their scores, and competing for prizes on a live leaderboard.

I became interested in game theory while teaching entrepreneurship and wanted to explore how incentives, competition, and incomplete information could influence participation.

## Features

- Weekly challenges with video submissions and verified leaderboards
- Live rankings, podium positions, and prizes
- In-app camera recording and video trimming
- Friends, profiles, video feeds, comments, and likes
- Push notifications and challenge reminders
- Admin verification, content moderation, and user reporting

## How I Built It

I started with Lovable, using detailed prompts and repeated testing to build the web application. I used Claude to review prompts and help investigate technical problems. Lovable generated most of the application code under my direction.

I then used GitHub, Terminal, Capacitor, and Xcode to package, configure, and test the iOS version.

One of the biggest challenges was getting the native camera working. Early versions showed a gray preview, failed to record, or couldn't access saved videos. After repeated device testing and troubleshooting, the project incorporated a custom Swift camera integration.

## Technology

- **Frontend:** React, TypeScript, TanStack, Tailwind CSS
- **Backend:** Supabase, PostgreSQL, authentication, and video storage
- **Mobile:** Capacitor, Xcode, Swift, Apple native APIs
- **Development:** Lovable, Claude, GitHub, Terminal

## My Contributions

I founded KOTH and designed its concept, branding, user interface, competition rules, moderation workflows, and incentive structure. I directed the AI-assisted implementation, tested and refined features, handled native iOS configuration and integration, wrote the legal policies, and managed the App Store submission.

## Development Process

This repository contains the application's source code, native iOS project, database migrations, and commit history documenting its development.

The project was developed through an AI-assisted workflow. Most application code was generated using Lovable, with my specifications, testing, feedback, and integration work guiding its development.

## What I Learned

KOTH taught me how much work happens between having an idea and making something people can actually use. Building it required learning unfamiliar tools, diagnosing failures, considering privacy and moderation, and balancing technical limitations with the experience I wanted to create.
