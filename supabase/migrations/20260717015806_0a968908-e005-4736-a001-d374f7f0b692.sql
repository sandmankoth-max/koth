
-- One-directional: is _viewer blocked by _owner?
CREATE OR REPLACE FUNCTION public.is_blocked_by(_viewer uuid, _owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _viewer IS NULL OR _owner IS NULL OR _viewer = _owner THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_blocks
      WHERE blocker_id = _owner AND blocked_id = _viewer
    )
  END;
$$;

-- Rewrite can_view_submission: viewer blocked by owner can't see
CREATE OR REPLACE FUNCTION public.can_view_submission(_viewer uuid, _submission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = _submission_id
      AND NOT public.is_blocked_by(_viewer, s.user_id)
      AND (
        s.visibility = 'public'
        OR s.user_id = _viewer
        OR public.are_friends(_viewer, s.user_id)
      )
  );
$$;

-- Profiles: hide owner from viewers the owner has blocked
DROP POLICY IF EXISTS "profiles readable by all auth" ON public.profiles;
CREATE POLICY "profiles readable by all auth" ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR NOT public.is_blocked_by(auth.uid(), id)
  );

-- Submissions
DROP POLICY IF EXISTS "submissions readable by visibility" ON public.submissions;
CREATE POLICY "submissions readable by visibility" ON public.submissions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      NOT public.is_blocked_by(auth.uid(), user_id)
      AND (
        visibility = 'public'
        OR public.are_friends(auth.uid(), user_id)
      )
    )
  );

-- Friendships: blocked user can't request
DROP POLICY IF EXISTS "users send friend requests" ON public.friendships;
CREATE POLICY "users send friend requests" ON public.friendships
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id
    AND NOT public.is_blocked_by(auth.uid(), addressee_id)
  );

-- Challenge comments: blocked user's comments still visible to others; but the blocker shouldn't see them
DROP POLICY IF EXISTS "anyone signed in can read challenge comments" ON public.challenge_comments;
CREATE POLICY "anyone signed in can read challenge comments" ON public.challenge_comments
  FOR SELECT USING (
    author_id = auth.uid()
    OR NOT public.is_blocked_by(author_id, auth.uid())
  );

-- Username-based block helpers (needed because blocker may still resolve blocked user's id)
CREATE OR REPLACE FUNCTION public.block_username(_username text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_target uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT id INTO v_target FROM public.profiles WHERE username = lower(trim(_username));
  IF v_target IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;
  IF v_target = auth.uid() THEN RAISE EXCEPTION 'cannot block yourself'; END IF;
  INSERT INTO public.user_blocks(blocker_id, blocked_id)
  VALUES (auth.uid(), v_target)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  -- Auto-remove any existing friendship in either direction
  DELETE FROM public.friendships
    WHERE (requester_id = auth.uid() AND addressee_id = v_target)
       OR (requester_id = v_target AND addressee_id = auth.uid());
  RETURN v_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  DELETE FROM public.user_blocks
    WHERE blocker_id = auth.uid() AND blocked_id = _target;
END;
$$;
