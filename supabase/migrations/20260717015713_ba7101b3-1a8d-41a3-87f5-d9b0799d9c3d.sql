
-- Blocks table
CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own blocks" ON public.user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "users create own blocks" ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);
CREATE POLICY "users delete own blocks" ON public.user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- Symmetric block check (either side blocked the other)
CREATE OR REPLACE FUNCTION public.is_blocked(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _a IS NULL OR _b IS NULL OR _a = _b THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_blocks
      WHERE (blocker_id = _a AND blocked_id = _b)
         OR (blocker_id = _b AND blocked_id = _a)
    )
  END;
$$;

-- Update can_view_submission to respect blocks
CREATE OR REPLACE FUNCTION public.can_view_submission(_viewer uuid, _submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = _submission_id
      AND NOT public.is_blocked(_viewer, s.user_id)
      AND (
        s.visibility = 'public'
        OR s.user_id = _viewer
        OR public.are_friends(_viewer, s.user_id)
      )
  );
$$;

-- Profiles: hide blocked users from each other
DROP POLICY IF EXISTS "profiles readable by all auth" ON public.profiles;
CREATE POLICY "profiles readable by all auth" ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR NOT public.is_blocked(auth.uid(), id)
  );

-- Submissions: exclude when either side blocked
DROP POLICY IF EXISTS "submissions readable by visibility" ON public.submissions;
CREATE POLICY "submissions readable by visibility" ON public.submissions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      NOT public.is_blocked(auth.uid(), user_id)
      AND (
        visibility = 'public'
        OR public.are_friends(auth.uid(), user_id)
      )
    )
  );

-- Friendships: block requests when blocked
DROP POLICY IF EXISTS "users send friend requests" ON public.friendships;
CREATE POLICY "users send friend requests" ON public.friendships
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id
    AND NOT public.is_blocked(auth.uid(), addressee_id)
  );

-- Challenge comments: hide comments from blocked users, prevent posting when blocker present
DROP POLICY IF EXISTS "anyone signed in can read challenge comments" ON public.challenge_comments;
CREATE POLICY "anyone signed in can read challenge comments" ON public.challenge_comments
  FOR SELECT USING (
    author_id = auth.uid()
    OR NOT public.is_blocked(auth.uid(), author_id)
  );
