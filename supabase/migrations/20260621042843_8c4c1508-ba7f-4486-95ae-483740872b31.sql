DROP POLICY IF EXISTS "results readable by authenticated" ON public.results;
CREATE POLICY "results readable by owner or admin" ON public.results
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));