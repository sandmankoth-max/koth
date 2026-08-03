create or replace function public.accept_invite(_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
  v_me uuid := auth.uid();
  v_existing public.friendships;
begin
  if v_me is null then raise exception 'auth required'; end if;
  select id into v_target from public.profiles where username = lower(trim(_username));
  if v_target is null then raise exception 'user not found'; end if;
  if v_target = v_me then return 'self'; end if;
  if public.is_blocked(v_me, v_target) then raise exception 'unavailable'; end if;

  select * into v_existing from public.friendships
   where (requester_id = v_me and addressee_id = v_target)
      or (requester_id = v_target and addressee_id = v_me)
   limit 1;

  if found then
    if v_existing.status = 'accepted' then return 'already'; end if;
    update public.friendships set status = 'accepted' where id = v_existing.id;
    return 'accepted';
  end if;

  insert into public.friendships(requester_id, addressee_id, status)
  values (v_target, v_me, 'accepted');
  return 'accepted';
end;
$$;

grant execute on function public.accept_invite(text) to authenticated;