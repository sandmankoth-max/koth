
-- Helper: true if user is admin OR moderator
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','moderator')
  )
$$;

-- Update RLS to allow moderators to update/delete any submission
DROP POLICY IF EXISTS "admins update any submission" ON public.submissions;
DROP POLICY IF EXISTS "admins delete any submission" ON public.submissions;

CREATE POLICY "staff update any submission" ON public.submissions
  FOR UPDATE USING (public.is_staff(auth.uid()));

CREATE POLICY "staff delete any submission" ON public.submissions
  FOR DELETE USING (public.is_staff(auth.uid()));

-- Let moderators call grading RPCs
CREATE OR REPLACE FUNCTION public.admin_disqualify_submission(p_submission_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s record;
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'forbidden';
  end if;
  select * into s from public.submissions where id = p_submission_id;
  if not found then raise exception 'not found'; end if;

  update public.submissions
    set status = 'disqualified',
        is_active_entry = false
    where id = p_submission_id;

  insert into public.notifications(user_id, type, payload)
  values (s.user_id, 'time_disqualified',
    jsonb_build_object(
      'challenge_id', s.challenge_id,
      'submission_id', s.id,
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    ));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_username text;
  f record;
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'forbidden';
  end if;
  select username into v_username from public.profiles where id = p_user_id;
  if v_username is null then raise exception 'user not found'; end if;

  update public.profiles
    set banned = true, banned_at = now(), banned_reason = p_reason
    where id = p_user_id;

  insert into public.banned_usernames(username, reason, banned_by)
  values (v_username, p_reason, auth.uid())
  on conflict (username) do update set reason = excluded.reason, banned_at = now(), banned_by = excluded.banned_by;

  for f in select distinct fp_hash from public.device_fingerprints where user_id = p_user_id loop
    insert into public.banned_fingerprints(fp_hash, reason, banned_by)
    values (f.fp_hash, p_reason, auth.uid())
    on conflict (fp_hash) do nothing;
  end loop;

  update public.submissions
    set status = 'disqualified', is_active_entry = false
    where user_id = p_user_id and is_active_entry = true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_submission(p_submission_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s record;
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'forbidden';
  end if;
  select * into s from public.submissions where id = p_submission_id;
  if not found then return; end if;

  delete from public.video_likes where submission_id = p_submission_id;
  delete from public.video_comments where submission_id = p_submission_id;
  delete from public.submissions where id = p_submission_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_restore_submission(p_submission_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s record;
begin
  if not public.is_staff(auth.uid()) then
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
end;
$function$;
