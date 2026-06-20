## Phase B + your clarifications

### 1. Data model changes (one migration)

- **Split "active entry"** so friends-only uploads never wipe history and never enter the public leaderboard:
  - `submissions.is_active_entry` keeps meaning "this user's leaderboard entry for this challenge" but ONLY the most recent `visibility='public'` row gets it. Friends-only rows are never active.
  - Rewrite `handle_new_submission` trigger:
    - On INSERT, if `NEW.visibility = 'public'`: clear `is_active_entry` on the user's prior PUBLIC rows for that challenge AND mark NEW as active (`is_active_entry = true`). Do NOT touch friends-only rows.
    - If `NEW.visibility = 'friends_only'`: force `is_active_entry = false`. Do not touch anything else.
- Update `close_challenge`, `notify_rank_changes`, `lifecycle_tick` reminder check, and `admin_ban_user` queries already filter on `is_active_entry` and `visibility='public'` implicitly (active rows are public only after the change) — verify and add `visibility='public'` where needed for safety.

### 2. Server function changes

- `deletePreviousSubmissionsForChallenge` (used in `record.tsx`): only run when the new submission is **public**, and only delete prior **public** submissions for that challenge (keep all friends-only history). Caller passes the new visibility.
- New `deleteOwnComment` server fn (also lets the video owner delete any comment on their own video): authorise as comment author OR submission owner, then delete.
- `deleteOwnSubmission` already exists — leave it; profile grid will reuse it for "delete this video" from your own page.

### 3. Position card "behind the next rank up"

`src/components/koth/position-card.tsx`: change the headline beneath your rank.

- If `myRank === 1`: "You're on top. Defend the hill."
- Else: compute `targetRank = myRank - 1`, find that user's value, message = `"<gap> behind #<targetRank>"`.
- Drop the existing "from the podium" sub-line (now redundant — #4 already says "behind #3").

### 4. Friends feed = public ∪ friends-only by your friends

`src/routes/_authenticated/friends.tsx` FeedTab query:

- Drop `is_active_entry` filter.
- Add `.or('visibility.eq.public,visibility.eq.friends_only')` and keep `user_id IN friends`, `challenge_id = active`, `status != 'disqualified'`.
- Sort by `submitted_at desc`. Multiple attempts per friend can show (matches "videos save to profile even with more attempts").

### 5. Visibility copy in record flow

`src/routes/_authenticated/record.tsx`:

- Rename "Friends Feed Only" tile to **"Save to your profile / friends only"** with body "Goes to your profile and your friends feed. Doesn't replace earlier attempts and isn't eligible for the prize pool."
- Public tile body adds "Replaces your previous public attempt for this challenge."
- Pass `visibility` to `deletePreviousSubmissionsForChallenge` so the server can skip the wipe for friends-only.

### 6. Profile grid shows every saved video + delete

`src/routes/_authenticated/profile.tsx` ChallengesTab:

- Remove `is_active_entry` filter so all friends-only history is listed (latest first). Public rows: still only the active one (older publics were deleted on upload).
- Long-press / overflow button on each tile opens a small action sheet with "Delete video" → calls `deleteOwnSubmission`. Invalidate `my-videos`, `my-entry`, leaderboard caches.
- Same delete affordance from inside `TikTokPlayer` when `item.user.id === currentUser.id` (small trash icon in the action rail).

### 7. Phase B — Comments drawer

New component `src/components/koth/comment-drawer.tsx` using existing `Drawer` from `src/components/ui/drawer.tsx`. Used for both kinds:

- Props: `kind: 'video' | 'challenge'`, `targetId` (submission_id or challenge_id), `open`, `onOpenChange`.
- Query top-level comments (parent_id null) with author profile, like state, reply_count. Replies fetched on expand.
- Composer at bottom with @mention autocomplete (see §8). Submit inserts row; optimistic update.
- Each comment row: avatar (Link to /u/$username), body with @username spans linked, like button (toggles `comment_likes` row with `kind='video'|'challenge'`), reply button (sets composer parent), and **trash** icon when `viewer.id === comment.author_id` OR (kind='video' AND viewer.id === submission.user_id). Trash calls `deleteOwnComment`.
- Threaded replies rendered indented under parent (one level deep, like TikTok).

### 8. @mention autocomplete

New util hook `useMentionSearch(q)` querying `profiles` by `username ilike '<q>%'` limit 6 (debounced 150ms). Composer parses last token starting with `@`, opens a popover list; selecting fills the username and stores the resolved `profile.id` in `taggedIds`. On submit, write the comment with `tagged_user_ids = Array.from(taggedIds matching final body)`.

### 9. Wire comment drawer into TikTokPlayer

`tiktok-player.tsx`: replace the "Comments coming soon" toast on the comment rail button with `setCommentsOpen(true)`, rendering `<CommentDrawer kind='video' targetId={item.id} />`. Trash icon added when the current user owns the video → calls `deleteOwnSubmission`, advances/closes player.

### 10. Live home-page chat (challenge chat)

New section in `src/routes/_authenticated/home.tsx` under the hero: "Trash talk" card showing the 3 most recent `challenge_comments` for the active challenge plus a "Open chat" button that opens `<CommentDrawer kind='challenge' targetId={c.id} />`. Realtime: subscribe via supabase channel on `challenge_comments` insert filtered by `challenge_id=c.id` to update the preview list and bump query.

### 11. App-wide tappable profile pictures

Add small wrapper `<ProfileAvatar username avatarPath name size />` (in `src/components/koth/avatar.tsx` or new file) that renders the Avatar inside `<Link to="/u/$username">`. Use it in:

- `home.tsx` TopThreePreview rows
- `leaderboard.tsx` rows
- `friends.tsx` feed cards
- `live-activity.tsx` items
- `notifications.tsx` rows (where a username is known)
- `tiktok-player.tsx` rail avatar (already a Link — leave)

### 12. Cache invalidation map

After comment insert/delete: `['video-comments', targetId]`, `['video-comment-count', targetId]`, and for challenge: `['challenge-comments', targetId]`. After like toggle in comment: per-comment like query.

---

## Technical notes

- All new tables already exist from the prior migration (`video_comments`, `challenge_comments`, `comment_likes`, etc.) — no new tables needed, just triggers and RLS adjustments if any are missing for delete by owner. I'll check `video_comments` policies and add a `DELETE` policy for `author_id = auth.uid()` and for the submission owner via `EXISTS` on submissions.
- Position card uses the same leaderboard query (post-change, that's purely public rows since friends-only is never active).
- No new dependencies.

## Out of scope (Phase C)

- Notification deep-linking that opens the comment thread at the right comment.
- Friends podium ranking ranking-by-friends-only.
- Share sheet implementation (still placeholder).

---

Reply "go" and I'll execute, or tell me what to drop/change.