
-- Revoke EXECUTE from PUBLIC and anon on all SECURITY DEFINER functions in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant to authenticated for functions called from the signed-in client
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.username_exists(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_announce_winners(text, numeric, text, numeric, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_announce_winners(text, numeric, text, numeric, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_notification(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_suspension(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_disqualify_submission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_notification(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_suspension(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_profile_moderation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_fingerprint_banned(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_submission(uuid, uuid) TO authenticated;
