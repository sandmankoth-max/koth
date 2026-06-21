
create or replace function public.admin_delete_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  select * into s from public.submissions where id = p_submission_id;
  if not found then return; end if;

  delete from public.video_likes where submission_id = p_submission_id;
  delete from public.video_comments where submission_id = p_submission_id;
  delete from public.submissions where id = p_submission_id;
end;
$$;

create or replace function public.notify_rank_changes(p_challenge_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  actor_username text;
  actor_new_rank int;
  actor_status text;
begin
  select username into actor_username from public.profiles where id = p_actor;

  select status into actor_status
  from public.submissions
  where challenge_id = p_challenge_id and user_id = p_actor and is_active_entry = true
  limit 1;

  with ranked as (
    select user_id, status,
      rank() over (order by coalesce(admin_verified_value, self_reported_value) desc) as rk
    from public.submissions
    where challenge_id = p_challenge_id
      and is_active_entry = true
      and status = 'verified'
  )
  select rk into actor_new_rank from ranked where user_id = p_actor;

  if actor_new_rank is null then
    -- still notify podium gained for verified entries below
    null;
  end if;

  -- Podium lost: only when verified entry passes another verified entry off the podium
  if actor_status = 'verified' and actor_new_rank is not null then
    for r in
      with ranked as (
        select user_id, status,
          rank() over (order by coalesce(admin_verified_value, self_reported_value) desc) as new_rank
        from public.submissions
        where challenge_id = p_challenge_id
          and is_active_entry = true
          and status = 'verified'
      )
      select user_id, new_rank from ranked
      where user_id <> p_actor
        and new_rank = 4
        and new_rank = actor_new_rank + 1
    loop
      insert into public.notifications(user_id, type, payload) values (
        r.user_id, 'podium_lost',
        jsonb_build_object('challenge_id', p_challenge_id, 'overtaken_by_username', actor_username, 'new_rank', r.new_rank)
      );
    end loop;
  end if;

  if actor_status = 'verified' and actor_new_rank is not null and actor_new_rank <= 3 then
    insert into public.notifications(user_id, type, payload) values (
      p_actor, 'podium_gained',
      jsonb_build_object('challenge_id', p_challenge_id, 'new_rank', actor_new_rank)
    );
  end if;
end;
$$;
