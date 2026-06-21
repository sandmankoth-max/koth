
-- 1. Add 'inactive' to challenge_status enum
ALTER TYPE public.challenge_status ADD VALUE IF NOT EXISTS 'inactive';
