
-- Attach the existing guard function as a BEFORE UPDATE trigger
DROP TRIGGER IF EXISTS trg_block_self_moderation_change ON public.profiles;
CREATE TRIGGER trg_block_self_moderation_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_block_self_moderation_change();

-- Column-level lockdown: authenticated users may only update non-moderation columns
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (username, display_name, avatar_url, bio, date_of_birth, age_consent_ack_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
