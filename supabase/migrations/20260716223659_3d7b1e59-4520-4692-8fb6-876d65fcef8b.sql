
-- =========================================================
-- 1) Lock down SECURITY DEFINER functions
-- =========================================================

-- Trigger-only functions: no one needs EXECUTE
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'trg_notify_rank','trg_notify_friendship','handle_new_user',
        'trg_send_push_notification','trg_challenge_comment_counts',
        'notify_send_push','notify_rank_changes','handle_new_submission',
        'trg_block_suspended_submission','trg_video_like_counts',
        'trg_comment_like_counts','trg_block_profane_comment',
        'trg_block_profane_bio','trg_video_comment_counts',
        'trg_notify_submission_status','trg_block_self_moderation_change'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

-- RPCs callable by authenticated users only (revoke anon/public)
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'submit_user_report','admin_resolve_report','admin_disqualify_submission',
        'admin_list_reports','admin_announce_winners','has_role',
        'admin_restore_submission','is_profane','is_fingerprint_banned',
        'get_my_profile','username_exists','are_friends','can_view_submission',
        'admin_delete_submission','is_staff','admin_clear_suspension',
        'is_suspended','admin_get_profile_moderation','admin_send_notification',
        'admin_suspend_user','admin_update_suspension','close_challenge',
        'admin_broadcast_notification','admin_ban_user','lifecycle_tick'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- =========================================================
-- 2) Prevent users from clearing their own ban/suspension
-- =========================================================
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (username, display_name, avatar_url, bio, date_of_birth, age_consent_ack_at)
  ON public.profiles TO authenticated;

-- =========================================================
-- 3) Explicit deny policies on push_config
-- =========================================================
DROP POLICY IF EXISTS "push_config no anon access" ON public.push_config;
DROP POLICY IF EXISTS "push_config no authenticated access" ON public.push_config;
CREATE POLICY "push_config no anon access" ON public.push_config
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "push_config no authenticated access" ON public.push_config
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- =========================================================
-- 4) Staff-only UPDATE/DELETE on user_reports
-- =========================================================
DROP POLICY IF EXISTS "staff update user_reports" ON public.user_reports;
DROP POLICY IF EXISTS "staff delete user_reports" ON public.user_reports;
CREATE POLICY "staff update user_reports" ON public.user_reports
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff delete user_reports" ON public.user_reports
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
