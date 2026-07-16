
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  username,
  display_name,
  avatar_url,
  bio,
  date_of_birth,
  age_consent_ack_at
) ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;
