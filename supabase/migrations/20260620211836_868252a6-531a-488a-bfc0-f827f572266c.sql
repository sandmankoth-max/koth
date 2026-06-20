
-- 1) Profiles: revoke column-level SELECT on sensitive cols from anon + authenticated
REVOKE SELECT (date_of_birth, banned, banned_reason, banned_at, age_consent_ack_at)
  ON public.profiles FROM anon, authenticated;

-- Ensure remaining safe columns are still selectable
GRANT SELECT (id, username, display_name, avatar_url, bio, created_at)
  ON public.profiles TO anon, authenticated;

-- 2) Results: restrict reads to authenticated users only
DROP POLICY IF EXISTS "results readable by all" ON public.results;
CREATE POLICY "results readable by authenticated"
  ON public.results FOR SELECT TO authenticated USING (true);

-- 3) video_comments: add visibility check to edit policy
DROP POLICY IF EXISTS "edit own comment" ON public.video_comments;
CREATE POLICY "edit own comment"
  ON public.video_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND public.can_view_submission(auth.uid(), submission_id))
  WITH CHECK (author_id = auth.uid() AND public.can_view_submission(auth.uid(), submission_id));

-- 4) Lock down SECURITY DEFINER functions that should not be callable via API.
-- Trigger functions:
REVOKE EXECUTE ON FUNCTION public.handle_new_submission() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_notify_rank() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_notify_friendship() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_notify_submission_status() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_video_like_counts() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_video_comment_counts() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_comment_like_counts() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_challenge_comment_counts() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_rank_changes(uuid, uuid) FROM anon, authenticated, public;

-- Admin/maintenance routines (still callable from server-side service_role; not needed via Data API)
REVOKE EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_disqualify_submission(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_restore_submission(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_send_notification(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_broadcast_notification(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.close_challenge(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.lifecycle_tick() FROM anon, authenticated, public;

-- Re-grant admin RPCs to authenticated since admin UI calls them via PostgREST; functions self-check has_role
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_disqualify_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_notification(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_notification(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_challenge(uuid) TO authenticated;

-- is_profane and is_fingerprint_banned only need internal use
REVOKE EXECUTE ON FUNCTION public.is_profane(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_fingerprint_banned(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.is_fingerprint_banned(text) TO anon, authenticated;
