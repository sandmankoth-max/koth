This is a large batch. I'll group everything into themed chunks so it's easy to review. Nothing here changes the core data model except adding **suspensions** and splitting the admin into a Grading panel + Punish panel.

## 1. Camera & recording (`native-camera-recorder.tsx`, `KothCameraPreviewPlugin.swift`)
- Default to **front camera** on open.
- Stop inverting the saved video — capture mirrored on front cam so playback matches the preview (set `isVideoMirrored = true` on the movie connection when front-facing).
- Allow **flip while recording**: swap the video input on the live `AVCaptureSession` without stopping the file output. Re-apply torch state for the new camera (back = real torch, front = white-overlay flash, same as preview).
- Fix review screen being clipped by bottom nav: the review/submit screen will use a safe-area bottom padding + scrollable container so buttons are always reachable. Nav bars stay fixed; the inner content scrolls.

## 2. Video thumbnails everywhere
- On submit upload, also generate a JPEG poster (~1s into the video, via `<video>` + canvas on web, AVAssetImageGenerator on iOS) and upload it to `koth-videos` alongside the mov, storing `thumb_path` on `submissions`.
- Use that thumbnail as the `poster` for every `<video>` (profile grid, friends profiles, admin grading, recorder review screen, tiktok player initial frame).
- Fallback for older rows with no thumb: client generates one on first render from the signed URL and caches it.

## 3. Notifications
- Remove the duplicate "suspended/rejected" notification — only the one with reason fires (reason optional).
- Rename `time_verified` copy → **"Your entry was verified"** (and "Your entry of X was verified" when a value exists). Same for any other "time"-specific strings.
- Bell badge: clear immediately when the notifications page mounts (optimistic), then sync.
- New podium move notifications: notify when a user **gains, loses, or moves** within the top 3 (not just "passed"). Welcome dialog copy updated to match.

## 4. Welcome dialog
- Third bullet → "Get notified if you're on the podium and someone takes your spot."

## 5. Submission validation
- Reject `.`, empty, or non-numeric self-reported values both client-side and in a DB check.

## 6. Friends feed page
- Keep the top tabs (Friends Feed / Add Friends) visible while scrolling the feed (sticky header inside the scroll container, not page-level).
- Fix the bottom caption being hidden behind the bottom nav (apply same safe-area padding the profile feed uses).

## 7. Comment drawer
- Fix the input being clipped at the bottom — add `env(safe-area-inset-bottom)` padding and make the drawer height respect `100dvh`.
- Unify styling so the drawer looks the same from feed, friends feed, and profile.

## 8. Admin **Grading** panel
- Don't auto-focus the value input when a video opens (remove `autoFocus`); it opens only when the user taps it.
- Add a persistent **Back/Exit (X)** button overlay in the scrolling grader.
- "Out of videos" empty state gets an **Exit** button back to admin home.
- Suspend button is renamed/relabeled — see #9. The current "Suspend" button (which actually rejects the video) becomes **Reject**, and every "suspended" tag/label across the app becomes "rejected".
- Show the 5 color tags currently in use somewhere on the panel header: **red, blue, green, yellow, purple** (5 total).

## 9. New admin **Punish** panel (separate tab from Grading)
- Two actions: **Ban** and **Suspend**.
- **Suspend**: pick a user (username autofill), set duration (preset chips: 1h, 24h, 3d, 7d, custom), set reason. While suspended:
  - Posting to the **challenge** feed is blocked (button greyed out with "Suspended until …, reason: …").
  - Posting to **friends** feed and recording still work.
  - Existing pending submissions stay in the grading queue (suspension does not auto-grade).
  - A notification is sent on suspend, and another when it ends (auto-expire or manually lifted).
- **Suspended Users** sub-tab: list current suspensions with username, time left, reason; actions to **shorten / extend / cancel**.
- Ban behavior unchanged: log out, prevent re-login (existing fingerprint + username bans).
- Mods get access to Punish panel (ban + suspend), same as Grading.

## 10. Username autofill component
- Snap-style typeahead: as you type, query `profiles` for matching usernames, show avatar + display name, tap to fill. Used in:
  - Punish panel (ban/suspend target)
  - Winners announcement form on the admin announce tab.

## 11. Admin panel layout/bug fixes
- Fix the broken **Staff** tab (currently errors). Likely a missing import / stale type after the moderator migration — repair the handler and grid layout.
- Reflow admin tab buttons so they wrap cleanly on mobile (CSS grid with consistent button heights, no overflowing borders).

## 12. Performance polish
- Add `loading="lazy"` and `decoding="async"` to thumbnails; preload only the visible tiktok video; pause off-screen videos.
- Memoize heavy lists (profile grid, friends feed); debounce typeahead queries.
- Use the new thumbnail poster so videos don't show a black frame while loading.

---

## Technical notes (database)

New columns/tables (one migration):
- `submissions.thumb_path text`
- `profiles.suspended_until timestamptz`, `profiles.suspension_reason text`, `profiles.suspended_at timestamptz`, `profiles.suspended_by uuid`
- Trigger / RPC: `admin_suspend_user(user_id, until, reason)`, `admin_update_suspension(user_id, until, reason)`, `admin_clear_suspension(user_id)`, plus a `lifecycle_tick` addition that fires `suspension_ended` notifications and clears expired suspensions.
- Update `handle_new_submission` (or add a BEFORE INSERT trigger) to reject challenge-feed submissions from suspended users, and to reject non-numeric/`.` self-reported values.
- New `app_role`-style policy: only staff (admin + moderator) can call the suspension RPCs.
- Remove the duplicate `admin_disqualify_submission` overload so only one notification is created.

I'll send the migration via the migration tool first, then update the UI in a follow-up pass once you approve. Want me to proceed with all 12 sections, or trim any of them?