-- Defense in depth: revoke broad UPDATE and re-grant only to non-moderation columns.
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;

GRANT UPDATE (
  username,
  display_name,
  date_of_birth,
  avatar_url,
  age_consent_ack_at,
  bio
) ON public.profiles TO authenticated;

-- service_role retains full access for staff RPCs / admin code
GRANT ALL ON public.profiles TO service_role;