
-- =========================
-- ENUMS
-- =========================
create type public.app_role as enum ('member','admin');
create type public.challenge_unit as enum ('time_seconds','count_reps','custom');
create type public.challenge_status as enum ('upcoming','active','closed','archived');
create type public.submission_status as enum ('pending_review','verified','flagged','disqualified');
create type public.friendship_status as enum ('pending','accepted');
create type public.notification_type as enum ('new_challenge','deadline_reminder','overtaken','podium_lost','podium_gained');
create type public.tie_resolution_kind as enum ('none','admin_broke_tie','split');

-- =========================
-- PROFILES
-- =========================
create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  date_of_birth date not null,
  avatar_url text,
  age_consent_ack_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.profiles(lower(username));

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "profiles readable by all auth"
  on public.profiles for select to authenticated using (true);
create policy "profiles readable by anon for username checks"
  on public.profiles for select to anon using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- =========================
-- USER ROLES
-- =========================
create table public.user_roles(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "users read own roles"
  on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- =========================
-- CHALLENGES
-- =========================
create table public.challenges(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  unit_type public.challenge_unit not null,
  unit_label text not null,
  safety_note text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.challenge_status not null default 'upcoming',
  prize_first numeric not null default 100,
  prize_second numeric not null default 20,
  prize_third numeric not null default 10,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.challenges(status);
create index on public.challenges(starts_at);

grant select on public.challenges to authenticated, anon;
grant insert, update, delete on public.challenges to authenticated;
grant all on public.challenges to service_role;
alter table public.challenges enable row level security;

create policy "challenges readable by all"
  on public.challenges for select using (true);
create policy "admins manage challenges"
  on public.challenges for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- =========================
-- SUBMISSIONS
-- =========================
create table public.submissions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  video_path text not null,
  self_reported_value numeric not null,
  admin_verified_value numeric,
  status public.submission_status not null default 'pending_review',
  is_active_entry boolean not null default true,
  submitted_at timestamptz not null default now()
);
create index on public.submissions(challenge_id);
create index on public.submissions(user_id, challenge_id);
create index on public.submissions(challenge_id, is_active_entry);

grant select on public.submissions to authenticated;
grant insert, update on public.submissions to authenticated;
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;

create policy "submissions readable by all auth"
  on public.submissions for select to authenticated using (true);
create policy "users insert own submissions"
  on public.submissions for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own submissions"
  on public.submissions for update to authenticated using (auth.uid() = user_id);
create policy "admins update any submission"
  on public.submissions for update to authenticated using (public.has_role(auth.uid(),'admin'));

-- =========================
-- FRIENDSHIPS
-- =========================
create table public.friendships(
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique(requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index on public.friendships(addressee_id, status);
create index on public.friendships(requester_id, status);

grant select, insert, update, delete on public.friendships to authenticated;
grant all on public.friendships to service_role;
alter table public.friendships enable row level security;

create policy "users see own friendships"
  on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "users send friend requests"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id);
create policy "addressee or requester update friendship"
  on public.friendships for update to authenticated
  using (auth.uid() = addressee_id or auth.uid() = requester_id);
create policy "either side can remove friendship"
  on public.friendships for delete to authenticated
  using (auth.uid() = addressee_id or auth.uid() = requester_id);

-- =========================
-- RESULTS
-- =========================
create table public.results(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank int not null,
  final_value numeric not null,
  prize_amount numeric not null default 0,
  tie_resolution public.tie_resolution_kind default 'none',
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  unique(challenge_id, user_id)
);
create index on public.results(user_id);
create index on public.results(challenge_id);

grant select on public.results to authenticated, anon;
grant insert, update, delete on public.results to authenticated;
grant all on public.results to service_role;
alter table public.results enable row level security;

create policy "results readable by all"
  on public.results for select using (true);
create policy "admins manage results"
  on public.results for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- =========================
-- NOTIFICATIONS
-- =========================
create table public.notifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, created_at desc);

grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

create policy "users read own notifications"
  on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "users update own notifications"
  on public.notifications for update to authenticated using (auth.uid() = user_id);
create policy "users delete own notifications"
  on public.notifications for delete to authenticated using (auth.uid() = user_id);

-- =========================
-- TRIGGERS
-- =========================

-- Auto-create profile + role on signup; auto-admin for username 'admin'
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text;
  v_display text;
  v_dob date;
  v_avatar text;
  v_consent timestamptz;
begin
  v_username := lower(coalesce(new.raw_user_meta_data->>'username', 'user_'||substr(replace(new.id::text,'-',''),1,8)));
  v_display := coalesce(new.raw_user_meta_data->>'display_name', v_username);
  v_dob := coalesce((new.raw_user_meta_data->>'date_of_birth')::date, '2000-01-01'::date);
  v_avatar := new.raw_user_meta_data->>'avatar_url';
  v_consent := coalesce((new.raw_user_meta_data->>'age_consent_ack_at')::timestamptz, now());

  insert into public.profiles(id, username, display_name, date_of_birth, avatar_url, age_consent_ack_at)
  values (new.id, v_username, v_display, v_dob, v_avatar, v_consent);

  insert into public.user_roles(user_id, role) values (new.id, 'member') on conflict do nothing;
  if v_username = 'admin' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Supersede previous active entry on new submission
create or replace function public.handle_new_submission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.submissions
    set is_active_entry = false
    where user_id = new.user_id
      and challenge_id = new.challenge_id
      and id <> new.id
      and is_active_entry = true;
  return new;
end; $$;

create trigger trg_submission_supersede
  after insert on public.submissions
  for each row execute function public.handle_new_submission();

-- Rank-change notifications
create or replace function public.notify_rank_changes(p_challenge_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  actor_username text;
  actor_new_rank int;
begin
  select username into actor_username from public.profiles where id = p_actor;

  with ranked as (
    select user_id,
      rank() over (order by coalesce(admin_verified_value, self_reported_value) desc) as rk
    from public.submissions
    where challenge_id = p_challenge_id
      and is_active_entry = true
      and status <> 'disqualified'
  )
  select rk into actor_new_rank from ranked where user_id = p_actor;

  if actor_new_rank is null then return; end if;

  -- For each user the actor surpassed, send overtaken / podium_lost
  for r in
    with ranked as (
      select user_id,
        rank() over (order by coalesce(admin_verified_value, self_reported_value) desc) as new_rank
      from public.submissions
      where challenge_id = p_challenge_id
        and is_active_entry = true
        and status <> 'disqualified'
    )
    select user_id, new_rank from ranked
    where user_id <> p_actor and new_rank > actor_new_rank and new_rank = actor_new_rank + 1
  loop
    insert into public.notifications(user_id, type, payload) values (
      r.user_id, 'overtaken',
      jsonb_build_object('challenge_id', p_challenge_id, 'overtaken_by_username', actor_username, 'new_rank', r.new_rank)
    );
    if r.new_rank = 4 then
      insert into public.notifications(user_id, type, payload) values (
        r.user_id, 'podium_lost',
        jsonb_build_object('challenge_id', p_challenge_id, 'overtaken_by_username', actor_username, 'new_rank', r.new_rank)
      );
    end if;
  end loop;

  if actor_new_rank <= 3 then
    insert into public.notifications(user_id, type, payload) values (
      p_actor, 'podium_gained',
      jsonb_build_object('challenge_id', p_challenge_id, 'new_rank', actor_new_rank)
    );
  end if;
end; $$;

create or replace function public.trg_notify_rank()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_rank_changes(new.challenge_id, new.user_id);
  return new;
end; $$;

create trigger trg_submission_rank_after_insert
  after insert on public.submissions
  for each row execute function public.trg_notify_rank();

create trigger trg_submission_rank_after_update
  after update of self_reported_value, admin_verified_value, status, is_active_entry on public.submissions
  for each row execute function public.trg_notify_rank();

-- Close challenge + populate results
create or replace function public.close_challenge(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c record;
  r record;
  prize numeric;
begin
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
    prize := case r.rk
      when 1 then c.prize_first
      when 2 then c.prize_second
      when 3 then c.prize_third
      else 0
    end;
    insert into public.results(challenge_id, user_id, rank, final_value, prize_amount)
    values (p_challenge_id, r.user_id, r.rk, r.final_value, prize)
    on conflict (challenge_id, user_id) do update
      set rank = excluded.rank, final_value = excluded.final_value, prize_amount = excluded.prize_amount;
  end loop;

  update public.challenges set status = 'closed' where id = p_challenge_id;
end; $$;

-- Scheduled lifecycle tick (called by cron or admin)
create or replace function public.lifecycle_tick()
returns void language plpgsql security definer set search_path = public as $$
declare
  c record;
  u record;
begin
  -- Activate upcoming challenges whose start has arrived
  for c in select * from public.challenges where status='upcoming' and starts_at <= now() loop
    update public.challenges set status='active' where id=c.id;
    insert into public.notifications(user_id, type, payload)
    select p.id, 'new_challenge', jsonb_build_object('challenge_id', c.id, 'title', c.title)
    from public.profiles p;
  end loop;

  -- Deadline reminders: 1h before close for active challenges (idempotent within window)
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
    end loop;
  end loop;

  -- Close challenges past their end time
  for c in select * from public.challenges where status='active' and ends_at <= now() loop
    perform public.close_challenge(c.id);
  end loop;
end; $$;

-- =========================
-- STORAGE POLICIES
-- =========================
-- Videos: any signed-in user can read; only owner can upload to {auth.uid()}/...
create policy "koth-videos readable by auth"
  on storage.objects for select to authenticated
  using (bucket_id = 'koth-videos');

create policy "koth-videos owner upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'koth-videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "koth-videos owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'koth-videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "koth-videos owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'koth-videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "koth-videos admins manage"
  on storage.objects for all to authenticated
  using (bucket_id = 'koth-videos' and public.has_role(auth.uid(),'admin'))
  with check (bucket_id = 'koth-videos' and public.has_role(auth.uid(),'admin'));

-- Avatars: any auth read; owner write to {auth.uid()}/...
create policy "koth-avatars readable by auth"
  on storage.objects for select to authenticated
  using (bucket_id = 'koth-avatars');

create policy "koth-avatars owner upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'koth-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "koth-avatars owner update"
  on storage.objects for update to authenticated
  using (bucket_id = 'koth-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "koth-avatars owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'koth-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
