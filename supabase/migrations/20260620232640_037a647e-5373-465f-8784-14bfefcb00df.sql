CREATE OR REPLACE FUNCTION public.admin_disqualify_submission(p_submission_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  s record;
begin
  if not public.has_role(auth.uid(), 'admin') then
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