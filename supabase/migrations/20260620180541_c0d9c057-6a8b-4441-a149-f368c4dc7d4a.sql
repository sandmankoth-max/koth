
-- Rewrite the new-submission trigger so only public submissions are
-- leaderboard-active, and only public uploads clear prior public actives.
create or replace function public.handle_new_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.visibility = 'public' then
    update public.submissions
      set is_active_entry = false
      where user_id = new.user_id
        and challenge_id = new.challenge_id
        and id <> new.id
        and is_active_entry = true;
    new.is_active_entry := true;
  else
    -- friends_only (or any non-public) submissions never enter the public
    -- leaderboard and never disturb existing entries.
    new.is_active_entry := false;
  end if;
  return new;
end;
$$;

-- Ensure trigger runs BEFORE INSERT so we can mutate NEW.is_active_entry.
drop trigger if exists trg_handle_new_submission on public.submissions;
create trigger trg_handle_new_submission
  before insert on public.submissions
  for each row execute function public.handle_new_submission();

-- Allow the submission owner to delete comments on their own video.
drop policy if exists "video owner can delete video comments" on public.video_comments;
create policy "video owner can delete video comments"
  on public.video_comments
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.user_id = auth.uid()
    )
  );
