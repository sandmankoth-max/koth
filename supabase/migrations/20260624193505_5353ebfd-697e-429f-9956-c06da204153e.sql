-- Revoke ability for regular users to update moderation-controlled columns on profiles
REVOKE UPDATE (banned, banned_at, banned_reason, suspended_until, suspension_reason, suspended_at, suspended_by)
  ON public.profiles FROM authenticated;

-- Enforce server-side length on comments
ALTER TABLE public.video_comments
  DROP CONSTRAINT IF EXISTS video_comments_body_length;
ALTER TABLE public.video_comments
  ADD CONSTRAINT video_comments_body_length CHECK (length(body) BETWEEN 1 AND 500);

ALTER TABLE public.challenge_comments
  DROP CONSTRAINT IF EXISTS challenge_comments_body_length;
ALTER TABLE public.challenge_comments
  ADD CONSTRAINT challenge_comments_body_length CHECK (length(body) BETWEEN 1 AND 500);