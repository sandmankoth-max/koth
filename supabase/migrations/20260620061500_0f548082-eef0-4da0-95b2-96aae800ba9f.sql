
drop function if exists public.lifecycle_tick();

create or replace function public.lifecycle_tick()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c record;
  u record;
  v_activated int := 0;
  v_reminders int := 0;
  v_closed int := 0;
begin
  for c in select * from public.challenges where status='upcoming' and starts_at <= now() loop
    update public.challenges set status='active' where id=c.id;
    insert into public.notifications(user_id, type, payload)
    select p.id, 'new_challenge', jsonb_build_object('challenge_id', c.id, 'title', c.title)
    from public.profiles p;
    v_activated := v_activated + 1;
  end loop;

  for c in select * from public.challenges
           where status='active'
             and ends_at - now() between interval '0 minutes' and interval '65 minutes' loop
    for u in
      select p.id from public.profiles p
      where not exists (
        select 1 from public.submissions s
        where s.challenge_id = c.id and s.user_id = p.id and s.is_active_entry = true
      )
      and not exists (
        select 1 from public.notifications n
        where n.user_id = p.id and n.type = 'deadline_reminder'
          and n.payload->>'challenge_id' = c.id::text
      )
    loop
      insert into public.notifications(user_id, type, payload)
      values (u.id,'deadline_reminder', jsonb_build_object('challenge_id', c.id, 'title', c.title));
      v_reminders := v_reminders + 1;
    end loop;
  end loop;

  for c in select * from public.challenges where status='active' and ends_at <= now() loop
    perform public.close_challenge(c.id);
    v_closed := v_closed + 1;
  end loop;

  return jsonb_build_object('activated', v_activated, 'reminders', v_reminders, 'closed', v_closed, 'ran_at', now());
end; $$;

create or replace function public.admin_restore_submission(p_submission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s record;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  select * into s from public.submissions where id = p_submission_id;
  if not found then raise exception 'not found'; end if;

  update public.submissions
    set is_active_entry = false
    where user_id = s.user_id
      and challenge_id = s.challenge_id
      and id <> s.id
      and is_active_entry = true;

  update public.submissions
    set is_active_entry = true,
        status = 'pending_review',
        admin_verified_value = null
    where id = s.id;
end; $$;
