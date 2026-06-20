
-- 1) Profiles: revoke column-level SELECT on sensitive fields from anon/authenticated
REVOKE SELECT (date_of_birth, banned, banned_reason, banned_at, age_consent_ack_at)
  ON public.profiles FROM anon, authenticated;

-- 2) Submissions: replace permissive SELECT with visibility-aware policy
DROP POLICY IF EXISTS "submissions readable by all auth" ON public.submissions;
CREATE POLICY "submissions readable by visibility"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR public.are_friends(auth.uid(), user_id)
  );

-- 3) Storage: replace blanket SELECT on koth-videos with visibility-aware check
DROP POLICY IF EXISTS "koth-videos readable by auth" ON storage.objects;
CREATE POLICY "koth-videos readable by visibility"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'koth-videos'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.video_path = storage.objects.name
          AND (
            s.visibility = 'public'
            OR public.are_friends(auth.uid(), s.user_id)
          )
      )
    )
  );
