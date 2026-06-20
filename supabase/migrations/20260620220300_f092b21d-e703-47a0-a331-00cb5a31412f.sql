
-- Profanity guard triggers for user-generated text
create or replace function public.trg_block_profane_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_profane(coalesce(new.body, '')) then
    raise exception 'Comment contains disallowed language' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

revoke execute on function public.trg_block_profane_comment() from public, anon, authenticated;

drop trigger if exists block_profane_video_comment on public.video_comments;
create trigger block_profane_video_comment
  before insert or update of body on public.video_comments
  for each row execute function public.trg_block_profane_comment();

drop trigger if exists block_profane_challenge_comment on public.challenge_comments;
create trigger block_profane_challenge_comment
  before insert or update of body on public.challenge_comments
  for each row execute function public.trg_block_profane_comment();

create or replace function public.trg_block_profane_bio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bio is not null and public.is_profane(new.bio) then
    raise exception 'Bio contains disallowed language' using errcode = 'check_violation';
  end if;
  if new.display_name is not null and public.is_profane(new.display_name) then
    raise exception 'Display name contains disallowed language' using errcode = 'check_violation';
  end if;
  return new;
end; $$;

revoke execute on function public.trg_block_profane_bio() from public, anon, authenticated;

drop trigger if exists block_profane_profile on public.profiles;
create trigger block_profane_profile
  before insert or update of bio, display_name on public.profiles
  for each row execute function public.trg_block_profane_bio();
