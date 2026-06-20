
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_submission() from public, anon, authenticated;
revoke execute on function public.notify_rank_changes(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.trg_notify_rank() from public, anon, authenticated;
revoke execute on function public.close_challenge(uuid) from public, anon, authenticated;
revoke execute on function public.lifecycle_tick() from public, anon, authenticated;
-- has_role MUST stay executable for RLS policies running as authenticated.
grant execute on function public.has_role(uuid, public.app_role) to authenticated, anon;
