-- Restrict column-level access on profiles
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, display_name, avatar_url, bio, banned, created_at)
  ON public.profiles TO authenticated;

-- Staff-only listing of suspended users (bypasses column grants via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_list_suspended()
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  suspended_until timestamptz,
  suspension_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.suspended_until, p.suspension_reason
  FROM public.profiles p
  WHERE public.is_staff(auth.uid())
    AND p.suspended_until IS NOT NULL
  ORDER BY p.suspended_until DESC
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_suspended() TO authenticated;