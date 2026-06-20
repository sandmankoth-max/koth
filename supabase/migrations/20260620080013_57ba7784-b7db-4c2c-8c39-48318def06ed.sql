
drop policy if exists "profiles readable by anon for username checks" on public.profiles;
revoke select on public.profiles from anon;

create or replace function public.username_exists(_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where username = lower(_username))
$$;
revoke execute on function public.username_exists(text) from public;
grant execute on function public.username_exists(text) to anon, authenticated;

revoke select (date_of_birth, banned_reason, banned, banned_at) on public.profiles from authenticated;

create or replace function public.get_my_profile()
returns public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;
revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

drop policy if exists "addressee or requester update friendship" on public.friendships;
create policy "addressee accepts friendship"
  on public.friendships for update to authenticated
  using (auth.uid() = addressee_id and status = 'pending')
  with check (auth.uid() = addressee_id and status = 'accepted');

create policy "admins manage banned fingerprints"
  on public.banned_fingerprints for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

revoke execute on function public.handle_new_submission() from public, anon, authenticated;
revoke execute on function public.trg_notify_submission_status() from public, anon, authenticated;
revoke execute on function public.trg_notify_rank() from public, anon, authenticated;
revoke execute on function public.trg_notify_friendship() from public, anon, authenticated;
revoke execute on function public.notify_rank_changes(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_profane(text) from public, anon, authenticated;
revoke execute on function public.lifecycle_tick() from public, anon, authenticated;
