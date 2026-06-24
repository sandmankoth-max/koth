
-- 1. Add thumbnail support to submissions
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS thumb_path text;

-- 2. Add suspension columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid;

-- 3. Helper: is user currently suspended
CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND suspended_until IS NOT NULL
      AND suspended_until > now()
  )
$$;

-- 4. Suspend a user (staff only)
CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id uuid, p_until timestamptz, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_until <= now() THEN
    RAISE EXCEPTION 'suspension end must be in the future';
  END IF;
  UPDATE public.profiles
    SET suspended_until = p_until,
        suspension_reason = nullif(trim(coalesce(p_reason,'')), ''),
        suspended_at = now(),
        suspended_by = auth.uid()
    WHERE id = p_user_id;

  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (p_user_id, 'admin_message',
    jsonb_build_object(
      'kind', 'suspended',
      'until', p_until,
      'reason', nullif(trim(coalesce(p_reason,'')), ''),
      'message', 'You have been suspended from posting to the challenge feed until ' || to_char(p_until at time zone 'UTC', 'YYYY-MM-DD HH24:MI UTC') ||
                  case when nullif(trim(coalesce(p_reason,'')), '') is not null then '. Reason: '||p_reason else '' end
    ));
END;
$$;

-- 5. Update existing suspension (extend/shorten/change reason)
CREATE OR REPLACE FUNCTION public.admin_update_suspension(p_user_id uuid, p_until timestamptz, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.profiles
    SET suspended_until = p_until,
        suspension_reason = nullif(trim(coalesce(p_reason,'')), '')
    WHERE id = p_user_id;
END;
$$;

-- 6. Clear suspension (staff only)
CREATE OR REPLACE FUNCTION public.admin_clear_suspension(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.profiles
    SET suspended_until = NULL,
        suspension_reason = NULL,
        suspended_at = NULL,
        suspended_by = NULL
    WHERE id = p_user_id AND suspended_until IS NOT NULL;

  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (p_user_id, 'admin_message',
    jsonb_build_object('kind','suspension_lifted','message','Your suspension has been lifted. You can post to the challenge feed again.'));
END;
$$;

-- 7. Lifecycle expansion: auto-clear expired suspensions and notify
CREATE OR REPLACE FUNCTION public.lifecycle_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare
  c record;
  u record;
  v_activated int := 0;
  v_rem_24h int := 0;
  v_rem_1h int := 0;
  v_unsuspended int := 0;
begin
  for c in select * from public.challenges
           where status = 'upcoming' and starts_at <= now()
           order by starts_at asc loop
    update public.challenges set status = 'inactive' where status in ('active','closed') and id <> c.id;
    update public.challenges set status = 'active' where id = c.id;
    insert into public.notifications(user_id, type, payload)
    select p.id, 'new_challenge', jsonb_build_object('challenge_id', c.id, 'title', c.title)
    from public.profiles p where coalesce(p.banned, false) = false;
    v_activated := v_activated + 1;
  end loop;

  for c in select * from public.challenges
           where status = 'active' and ends_at - now() between interval '23 hours' and interval '25 hours' loop
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

  for c in select * from public.challenges
           where status = 'active' and ends_at - now() between interval '0 minutes' and interval '65 minutes' loop
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

  -- Expire suspensions
  for u in select id from public.profiles
           where suspended_until is not null and suspended_until <= now() loop
    update public.profiles
      set suspended_until = null, suspension_reason = null, suspended_at = null, suspended_by = null
      where id = u.id;
    insert into public.notifications(user_id, type, payload)
    values (u.id, 'admin_message',
      jsonb_build_object('kind','suspension_ended','message','Your suspension has ended. You can post to the challenge feed again.'));
    v_unsuspended := v_unsuspended + 1;
  end loop;

  return jsonb_build_object('activated', v_activated, 'reminders_24h', v_rem_24h, 'reminders_1h', v_rem_1h, 'unsuspended', v_unsuspended, 'ran_at', now());
end; $$;

-- 8. Block challenge-feed submissions for suspended users (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.trg_block_suspended_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.visibility = 'public' AND public.is_suspended(NEW.user_id) THEN
    RAISE EXCEPTION 'You are suspended from posting to the challenge feed.' USING errcode='check_violation';
  END IF;
  IF NEW.self_reported_value IS NULL OR NEW.self_reported_value <= 0 THEN
    RAISE EXCEPTION 'Self-reported value must be greater than zero.' USING errcode='check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_suspended_submission ON public.submissions;
CREATE TRIGGER block_suspended_submission
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_suspended_submission();

-- 9. Replace admin_disqualify_submission overloads with a single canonical (reason optional)
DROP FUNCTION IF EXISTS public.admin_disqualify_submission(uuid);

CREATE OR REPLACE FUNCTION public.admin_disqualify_submission(p_submission_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
declare s record;
begin
  if not public.is_staff(auth.uid()) then raise exception 'forbidden'; end if;
  select * into s from public.submissions where id = p_submission_id;
  if not found then raise exception 'not found'; end if;

  update public.submissions
    set status = 'disqualified', is_active_entry = false
    where id = p_submission_id;
  -- Notification is emitted by trg_notify_submission_status; include reason there
  update public.submissions set status = status where id = p_submission_id; -- no-op to settle
  insert into public.notifications(user_id, type, payload)
  values (s.user_id, 'time_disqualified',
    jsonb_build_object(
      'challenge_id', s.challenge_id,
      'submission_id', s.id,
      'reason', nullif(trim(coalesce(p_reason,'')), '')
    ));
end;
$$;

-- The trg_notify_submission_status trigger ALSO inserts a time_disqualified notification.
-- To avoid duplicate notifications, drop the status-change trigger's disqualified branch by
-- replacing the trigger function to skip status='disqualified' (handled by RPC instead).
CREATE OR REPLACE FUNCTION public.trg_notify_submission_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
begin
  if new.status is distinct from old.status then
    if new.status = 'verified' then
      insert into public.notifications(user_id, type, payload)
      values (new.user_id, 'time_verified',
        jsonb_build_object('challenge_id', new.challenge_id, 'submission_id', new.id,
          'value', coalesce(new.admin_verified_value, new.self_reported_value)));
    end if;
    -- disqualified notification is emitted by admin_disqualify_submission RPC (single source)
  end if;
  return new;
end; $$;

-- 10. Expose suspension info in profile read for self (RLS already covers own profile read)
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_suspension(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_suspension(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated;
