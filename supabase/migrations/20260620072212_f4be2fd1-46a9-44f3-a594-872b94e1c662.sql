GRANT DELETE ON public.submissions TO authenticated;

DROP POLICY IF EXISTS "users delete own submissions" ON public.submissions;
CREATE POLICY "users delete own submissions"
  ON public.submissions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins delete any submission" ON public.submissions;
CREATE POLICY "admins delete any submission"
  ON public.submissions
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
