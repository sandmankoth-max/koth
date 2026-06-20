
-- 1. Add per-challenge max video length
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS max_video_seconds integer;

-- 2. Friends-only submissions: auto-verified, no admin review needed
CREATE OR REPLACE FUNCTION public.handle_new_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.visibility = 'public' then
    update public.submissions
      set is_active_entry = false
      where user_id = new.user_id
        and challenge_id = new.challenge_id
        and id <> new.id
        and is_active_entry = true;
    new.is_active_entry := true;
    -- public still requires admin verification before podium
    if new.status is null then
      new.status := 'pending_review';
    end if;
  else
    -- friends_only: never on public leaderboard, but auto-verified
    new.is_active_entry := false;
    new.status := 'verified';
  end if;
  return new;
end;
$function$;
