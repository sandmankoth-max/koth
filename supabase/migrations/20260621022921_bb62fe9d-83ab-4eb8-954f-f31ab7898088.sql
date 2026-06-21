
CREATE OR REPLACE FUNCTION public.close_challenge(p_challenge_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c record;
  r record;
  prize numeric;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;

  select * into c from public.challenges where id = p_challenge_id;
  if not found then return; end if;

  delete from public.results where challenge_id = p_challenge_id;

  for r in
    with ranked as (
      select user_id,
        coalesce(admin_verified_value, self_reported_value) as final_value,
        rank() over (order by coalesce(admin_verified_value, self_reported_value) desc) as rk
      from public.submissions
      where challenge_id = p_challenge_id
        and is_active_entry = true
        and status <> 'disqualified'
    )
    select * from ranked where rk <= 10 order by rk
  loop
    prize := case r.rk when 1 then c.prize_first when 2 then c.prize_second when 3 then c.prize_third else 0 end;
    insert into public.results(challenge_id, user_id, rank, final_value, prize_amount)
    values (p_challenge_id, r.user_id, r.rk, r.final_value, prize)
    on conflict (challenge_id, user_id) do update
      set rank = excluded.rank, final_value = excluded.final_value, prize_amount = excluded.prize_amount;
  end loop;

  update public.challenges set status = 'closed' where id = p_challenge_id;

  -- Notify everyone the challenge has closed
  insert into public.notifications(user_id, type, payload)
  select p.id, 'challenge_closed',
    jsonb_build_object('challenge_id', c.id, 'title', c.title)
  from public.profiles p
  where coalesce(p.banned, false) = false;
end; $function$;
