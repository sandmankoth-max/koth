
-- 1. Wipe all videos / submission-related data
DELETE FROM public.comment_likes WHERE kind = 'video';
DELETE FROM public.video_likes;
DELETE FROM public.video_comments;
DELETE FROM public.submissions;
DELETE FROM public.results;

-- 2. Fix current double-active state: keep most recent active, mark older active+closed as inactive
WITH latest AS (
  SELECT id FROM public.challenges
  WHERE status IN ('active','closed')
  ORDER BY starts_at DESC LIMIT 1
)
UPDATE public.challenges
SET status = 'inactive'
WHERE status IN ('active','closed')
  AND id NOT IN (SELECT id FROM latest);

-- 3. New lifecycle_tick: activate scheduled challenges (superseding prior),
--    send reminders, and DO NOT auto-close anything.
CREATE OR REPLACE FUNCTION public.lifecycle_tick()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  c record;
  u record;
  v_activated int := 0;
  v_rem_24h int := 0;
  v_rem_1h int := 0;
begin
  -- Activate upcoming challenges whose start has arrived. Each newly-active
  -- challenge supersedes ALL prior active/closed challenges (only one active).
  for c in select * from public.challenges
           where status = 'upcoming' and starts_at <= now()
           order by starts_at asc loop
    update public.challenges
      set status = 'inactive'
      where status in ('active','closed')
        and id <> c.id;

    update public.challenges set status = 'active' where id = c.id;

    insert into public.notifications(user_id, type, payload)
    select p.id, 'new_challenge', jsonb_build_object('challenge_id', c.id, 'title', c.title)
    from public.profiles p where coalesce(p.banned, false) = false;
    v_activated := v_activated + 1;
  end loop;

  -- 24h reminder
  for c in select * from public.challenges
           where status = 'active'
             and ends_at - now() between interval '23 hours' and interval '25 hours' loop
    for u in
      select p.id from public.profiles p
      where coalesce(p.banned, false) = false
        and not exists (select 1 from public.submissions s where s.challenge_id = c.id and s.user_id = p.id and s.is_active_entry = true)
        and not exists (select 1 from public.notifications n where n.user_id = p.id and n.type = 'deadline_reminder_24h' and n.payload->>'challenge_id' = c.id::text)
    loop
      insert into public.notifications(user_id, type, payload)
      values (u.id, 'deadline_reminder_24h', jsonb_build_object('challenge_id', c.id, 'title', c.title));
      v_rem_24h := v_rem_24h + 1;
    end loop;
  end loop;

  -- 1h reminder
  for c in select * from public.challenges
           where status = 'active'
             and ends_at - now() between interval '0 minutes' and interval '65 minutes' loop
    for u in
      select p.id from public.profiles p
      where coalesce(p.banned, false) = false
        and not exists (select 1 from public.submissions s where s.challenge_id = c.id and s.user_id = p.id and s.is_active_entry = true)
        and not exists (select 1 from public.notifications n where n.user_id = p.id and n.type = 'deadline_reminder' and n.payload->>'challenge_id' = c.id::text)
    loop
      insert into public.notifications(user_id, type, payload)
      values (u.id, 'deadline_reminder', jsonb_build_object('challenge_id', c.id, 'title', c.title));
      v_rem_1h := v_rem_1h + 1;
    end loop;
  end loop;

  return jsonb_build_object('activated', v_activated, 'reminders_24h', v_rem_24h, 'reminders_1h', v_rem_1h, 'ran_at', now());
end; $function$;

-- 4. Admin announce winners → broadcast a banner notification to everyone
CREATE OR REPLACE FUNCTION public.admin_announce_winners(
  p_first_username text,  p_first_amount numeric,
  p_second_username text, p_second_amount numeric,
  p_third_username text,  p_third_amount numeric,
  p_note text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_first uuid; v_second uuid; v_third uuid;
  v_count int;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;

  select id into v_first  from public.profiles where username = lower(trim(p_first_username));
  select id into v_second from public.profiles where username = lower(trim(p_second_username));
  select id into v_third  from public.profiles where username = lower(trim(p_third_username));
  if v_first is null  then raise exception 'First place user not found: %',  p_first_username;  end if;
  if v_second is null then raise exception 'Second place user not found: %', p_second_username; end if;
  if v_third is null  then raise exception 'Third place user not found: %',  p_third_username;  end if;

  insert into public.notifications(user_id, type, payload)
  select p.id, 'winners_announcement',
    jsonb_build_object(
      'first_user_id', v_first,   'first_username',  lower(trim(p_first_username)),  'first_amount',  p_first_amount,
      'second_user_id', v_second, 'second_username', lower(trim(p_second_username)), 'second_amount', p_second_amount,
      'third_user_id', v_third,   'third_username',  lower(trim(p_third_username)),  'third_amount',  p_third_amount,
      'note', nullif(trim(coalesce(p_note,'')), ''),
      'announced_at', now()
    )
  from public.profiles p
  where coalesce(p.banned, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  return v_count;
end; $function$;
