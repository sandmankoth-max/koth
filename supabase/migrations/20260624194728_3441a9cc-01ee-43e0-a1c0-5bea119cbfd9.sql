-- Re-revoke direct UPDATE on moderation-controlled columns (idempotent safety net)
REVOKE UPDATE (banned, banned_at, banned_reason, suspended_until, suspension_reason, suspended_at, suspended_by)
  ON public.profiles FROM authenticated;
REVOKE UPDATE (banned, banned_at, banned_reason, suspended_until, suspension_reason, suspended_at, suspended_by)
  ON public.profiles FROM anon;

-- Defense in depth: block non-staff from changing moderation columns even if column grants are widened later
CREATE OR REPLACE FUNCTION public.trg_block_self_moderation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    -- Server-side / service_role context — allow
    RETURN NEW;
  END IF;
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.banned IS DISTINCT FROM OLD.banned
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
     OR NEW.suspended_until IS DISTINCT FROM OLD.suspended_until
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
  THEN
    RAISE EXCEPTION 'You are not allowed to modify moderation fields.'
      USING errcode = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_self_moderation_change ON public.profiles;
CREATE TRIGGER trg_block_self_moderation_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_block_self_moderation_change();