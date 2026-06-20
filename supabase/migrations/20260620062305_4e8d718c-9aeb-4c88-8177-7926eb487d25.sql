-- Ban infrastructure + profanity guard
alter table public.profiles
  add column if not exists banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_reason text;

create table if not exists public.banned_usernames (
  username text primary key,
  reason text,
  banned_at timestamptz not null default now(),
  banned_by uuid references auth.users(id) on delete set null
);

grant select on public.banned_usernames to authenticated;
grant all on public.banned_usernames to service_role;
alter table public.banned_usernames enable row level security;

create policy "Admins manage banned usernames"
  on public.banned_usernames for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Profanity list (simple substring match, case-insensitive)
create or replace function public.is_profane(_text text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  t text := lower(coalesce(_text, ''));
  words text[] := array[
    'fuck','shit','bitch','cunt','nigger','nigga','faggot','fag','retard',
    'rape','rapist','slut','whore','dick','pussy','cock','asshole','kike',
    'chink','spic','tranny','pedo','pedophile','molest'
  ];
  w text;
begin
  foreach w in array words loop
    if position(w in t) > 0 then
      return true;
    end if;
  end loop;
  return false;
end; $$;

-- Update handle_new_user to enforce ban list + profanity at signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  if exists (select 1 from public.banned_usernames where username = v_username) then
    raise exception 'This username is not available.';
  end if;
  if public.is_profane(v_username) or public.is_profane(v_display) then
    raise exception 'Username or display name contains disallowed language.';
  end if;

  insert into public.profiles(id, username, display_name, date_of_birth, avatar_url, age_consent_ack_at)
  values (new.id, v_username, v_display, v_dob, v_avatar, v_consent);

  insert into public.user_roles(user_id, role) values (new.id, 'member') on conflict do nothing;
  if v_username = 'admin' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end; $$;

-- Admin ban RPC: flags profile, blacklists username, marks any active submission disqualified
create or replace function public.admin_ban_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  select username into v_username from public.profiles where id = p_user_id;
  if v_username is null then raise exception 'user not found'; end if;

  update public.profiles
    set banned = true,
        banned_at = now(),
        banned_reason = p_reason
    where id = p_user_id;

  insert into public.banned_usernames(username, reason, banned_by)
  values (v_username, p_reason, auth.uid())
  on conflict (username) do update set reason = excluded.reason, banned_at = now(), banned_by = excluded.banned_by;

  update public.submissions
    set status = 'disqualified', is_active_entry = false
    where user_id = p_user_id and is_active_entry = true;
end; $$;