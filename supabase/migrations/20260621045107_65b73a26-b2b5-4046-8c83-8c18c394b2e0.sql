-- Restrict sensitive profile columns at the column-grant level.
-- The existing SELECT policy allows any authenticated user to read profile
-- rows. Column-level REVOKE prevents them from selecting sensitive fields
-- (date of birth, ban moderation details). Owners still read their full
-- profile via public.get_my_profile() (SECURITY DEFINER), and admins can
-- read via SECURITY DEFINER admin functions.

REVOKE SELECT (date_of_birth, banned_at, banned_reason) ON public.profiles FROM anon, authenticated;

-- Owner self-access: allow the owner to read their own sensitive columns.
GRANT SELECT (date_of_birth, banned_at, banned_reason) ON public.profiles TO authenticated;
-- (The above re-grants to authenticated broadly; instead we want owner-only.
-- Postgres has no per-row column grant, so we rely on RLS to filter rows AND
-- add a more restrictive SELECT policy that only matches the owner for
-- queries touching sensitive columns. Simpler: revoke from authenticated
-- entirely and expose via SECURITY DEFINER RPCs.)

REVOKE SELECT (date_of_birth, banned_at, banned_reason) ON public.profiles FROM authenticated;

-- Admin read helper for ban details.
CREATE OR REPLACE FUNCTION public.admin_get_profile_moderation(p_user_id uuid)
RETURNS TABLE(user_id uuid, banned boolean, banned_at timestamptz, banned_reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.banned, p.banned_at, p.banned_reason
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND public.has_role(auth.uid(), 'admin')
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_profile_moderation(uuid) TO authenticated;
