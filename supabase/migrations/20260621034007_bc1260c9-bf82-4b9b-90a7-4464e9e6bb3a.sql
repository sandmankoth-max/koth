CREATE OR REPLACE FUNCTION public.admin_announce_winners(
  p_first_username text,  p_first_amount numeric,
  p_second_username text, p_second_amount numeric,
  p_third_username text,  p_third_amount numeric,
  p_note text DEFAULT NULL,
  p_headline text DEFAULT NULL
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
      'headline', nullif(trim(coalesce(p_headline,'')), ''),
      'announced_at', now()
    )
  from public.profiles p
  where coalesce(p.banned, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  return v_count;
end; $function$;