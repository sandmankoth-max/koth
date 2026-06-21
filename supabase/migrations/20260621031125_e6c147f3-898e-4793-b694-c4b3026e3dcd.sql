
-- 1) Restrict sensitive profile columns from other users via column grants
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, username, display_name, avatar_url, bio, created_at) ON public.profiles TO authenticated, anon;
-- service_role retains ALL via existing grants

-- 2) Remove self-equality short circuit in are_friends
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = _a AND f.addressee_id = _b)
        OR (f.requester_id = _b AND f.addressee_id = _a))
  );
$$;

-- 3) Restrict comment_likes SELECT to likes on accessible content
DROP POLICY IF EXISTS "view comment likes" ON public.comment_likes;
CREATE POLICY "view comment likes" ON public.comment_likes
FOR SELECT TO authenticated
USING (
  kind = 'challenge'
  OR (
    kind = 'video'
    AND EXISTS (
      SELECT 1 FROM public.video_comments vc
      WHERE vc.id = comment_likes.comment_id
        AND public.can_view_submission(auth.uid(), vc.submission_id)
    )
  )
);
