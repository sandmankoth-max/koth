
DROP POLICY "profiles readable by all auth" ON public.profiles;
CREATE POLICY "profiles readable by all auth" ON public.profiles
  FOR SELECT TO authenticated
  USING ((auth.uid() = id) OR (NOT public.is_blocked_by(auth.uid(), id)));

DROP POLICY "anyone signed in can read challenge comments" ON public.challenge_comments;
CREATE POLICY "anyone signed in can read challenge comments" ON public.challenge_comments
  FOR SELECT TO authenticated
  USING ((author_id = auth.uid()) OR (NOT public.is_blocked_by(author_id, auth.uid())));
