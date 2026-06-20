
-- Device fingerprint tables
create table if not exists public.device_fingerprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fp_hash text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique(user_id, fp_hash)
);
create index if not exists idx_device_fingerprints_hash on public.device_fingerprints(fp_hash);

grant select, insert on public.device_fingerprints to authenticated;
grant all on public.device_fingerprints to service_role;
alter table public.device_fingerprints enable row level security;

create policy "users insert own fingerprint" on public.device_fingerprints
  for insert to authenticated with check (auth.uid() = user_id);
create policy "users read own fingerprint" on public.device_fingerprints
  for select to authenticated using (auth.uid() = user_id);

create table if not exists public.banned_fingerprints (
  fp_hash text primary key,
  reason text,
  banned_by uuid references auth.users(id),
  banned_at timestamptz not null default now()
);
grant select on public.banned_fingerprints to authenticated;
grant all on public.banned_fingerprints to service_role;
alter table public.banned_fingerprints enable row level security;
-- no policies for authenticated writes; only via security-definer functions

-- Check fingerprint against blacklist (callable pre-signup)
create or replace function public.is_fingerprint_banned(_fp text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.banned_fingerprints where fp_hash = _fp)
$$;
grant execute on function public.is_fingerprint_banned(text) to anon, authenticated;

-- Allow admins to close a challenge directly from the UI
create or replace function public.close_challenge(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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
end; $$;
grant execute on function public.close_challenge(uuid) to authenticated;

-- Extend ban: also blacklist all known fingerprints for the user
create or replace function public.admin_ban_user(p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_username text;
  f record;
begin
  if not public.has_role(auth.uid(), 'admin') then
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
end; $$;

-- Notify users when their submission is verified or disqualified by an admin
create or replace function public.trg_notify_submission_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'verified' then
      insert into public.notifications(user_id, type, payload)
      values (new.user_id, 'time_verified',
        jsonb_build_object('challenge_id', new.challenge_id, 'submission_id', new.id,
          'value', coalesce(new.admin_verified_value, new.self_reported_value)));
    elsif new.status = 'disqualified' then
      insert into public.notifications(user_id, type, payload)
      values (new.user_id, 'time_disqualified',
        jsonb_build_object('challenge_id', new.challenge_id, 'submission_id', new.id));
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_submission_status_notify on public.submissions;
create trigger trg_submission_status_notify
  after update of status on public.submissions
  for each row execute function public.trg_notify_submission_status();

-- Lifecycle: also fire a 24h reminder, and keep existing 1h reminder + activation + close
create or replace function public.lifecycle_tick()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c record;
  u record;
  v_activated int := 0;
  v_rem_24h int := 0;
  v_rem_1h int := 0;
  v_closed int := 0;
begin
  -- Activate upcoming challenges whose start has arrived
  for c in select * from public.challenges where status='upcoming' and starts_at <= now() loop
    update public.challenges set status='active' where id=c.id;
    insert into public.notifications(user_id, type, payload)
    select p.id, 'new_challenge', jsonb_build_object('challenge_id', c.id, 'title', c.title)
    from public.profiles p where coalesce(p.banned, false) = false;
    v_activated := v_activated + 1;
  end loop;

  -- 24h reminder
  for c in select * from public.challenges
           where status='active'
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
           where status='active'
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

  -- Close expired
  for c in select * from public.challenges where status='active' and ends_at <= now() loop
    perform public.close_challenge(c.id);
    v_closed := v_closed + 1;
  end loop;

  return jsonb_build_object('activated', v_activated, 'reminders_24h', v_rem_24h, 'reminders_1h', v_rem_1h, 'closed', v_closed, 'ran_at', now());
end; $$;
grant execute on function public.lifecycle_tick() to authenticated;
