INSERT INTO public.banned_usernames(username, reason)
VALUES ('admin', 'Reserved username')
ON CONFLICT (username) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  if v_dob > (current_date - interval '13 years')::date then
    raise exception 'You must be 13 or older to sign up.';
  end if;

  if exists (select 1 from public.banned_usernames where username = v_username) then
    raise exception 'This username is not available.';
  end if;
  if public.is_profane(v_username) or public.is_profane(v_display) then
    raise exception 'Username or display name contains disallowed language.';
  end if;

  insert into public.profiles(id, username, display_name, date_of_birth, avatar_url, age_consent_ack_at)
  values (new.id, v_username, v_display, v_dob, v_avatar, v_consent);

  insert into public.user_roles(user_id, role) values (new.id, 'member') on conflict do nothing;
  return new;
end;
$function$;