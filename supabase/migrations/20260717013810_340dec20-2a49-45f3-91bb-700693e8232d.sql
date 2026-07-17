-- Revoke blanket UPDATE and re-grant only on non-moderation columns
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  username,
  display_name,
  date_of_birth,
  avatar_url,
  bio,
  age_consent_ack_at
) ON public.profiles TO authenticated;

-- Keep service_role full access for admin RPCs (SECURITY DEFINER functions run as owner, unaffected)
GRANT ALL ON public.profiles TO service_role;

-- Trigger public.trg_block_self_moderation_change already exists as defense-in-depth.