-- 1) profiles: re-assert column-level SELECT so sensitive fields are never
-- reachable through the Data API, regardless of the row-level policy.
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, display_name, avatar_url, bio, created_at)
  ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2) user_roles: explicit admin-only write policies.
DROP POLICY IF EXISTS "admins insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins delete user_roles" ON public.user_roles;

CREATE POLICY "admins insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
