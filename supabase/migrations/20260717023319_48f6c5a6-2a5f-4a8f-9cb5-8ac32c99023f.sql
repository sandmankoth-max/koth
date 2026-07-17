CREATE OR REPLACE FUNCTION public.trg_video_like_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_actor_username text;
  v_exists boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.submissions SET like_count = like_count + 1 WHERE id = NEW.submission_id;
    SELECT user_id INTO v_owner FROM public.submissions WHERE id = NEW.submission_id;
    IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
      SELECT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_owner
          AND type = 'like_video'
          AND created_at > now() - interval '60 minutes'
          AND payload->>'submission_id' = NEW.submission_id::text
          AND payload->>'from_user_id' = NEW.user_id::text
      ) INTO v_exists;
      IF NOT v_exists THEN
        SELECT username INTO v_actor_username FROM public.profiles WHERE id = NEW.user_id;
        INSERT INTO public.notifications(user_id, type, payload)
        VALUES (v_owner, 'like_video',
          jsonb_build_object('submission_id', NEW.submission_id, 'from_user_id', NEW.user_id, 'from_username', v_actor_username));
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.submissions SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.submission_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_comment_like_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_author uuid;
  v_actor_username text;
  v_submission uuid;
  v_challenge uuid;
  v_exists boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kind = 'video' THEN
      UPDATE public.video_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id
        RETURNING author_id, submission_id INTO v_author, v_submission;
    ELSE
      UPDATE public.challenge_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id
        RETURNING author_id, challenge_id INTO v_author, v_challenge;
    END IF;
    IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
      SELECT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_author
          AND type = 'like_comment'
          AND created_at > now() - interval '60 minutes'
          AND payload->>'kind' = NEW.kind::text
          AND payload->>'comment_id' = NEW.comment_id::text
          AND payload->>'from_user_id' = NEW.user_id::text
      ) INTO v_exists;
      IF NOT v_exists THEN
        SELECT username INTO v_actor_username FROM public.profiles WHERE id = NEW.user_id;
        INSERT INTO public.notifications(user_id, type, payload)
        VALUES (v_author, 'like_comment',
          jsonb_build_object('kind', NEW.kind, 'comment_id', NEW.comment_id,
            'submission_id', v_submission, 'challenge_id', v_challenge,
            'from_user_id', NEW.user_id, 'from_username', v_actor_username));
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.kind = 'video' THEN
      UPDATE public.video_comments SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.comment_id;
    ELSE
      UPDATE public.challenge_comments SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.comment_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $function$;

DROP POLICY IF EXISTS "submissions readable by visibility" ON public.submissions;
CREATE POLICY "submissions readable by visibility"
  ON public.submissions
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR visibility = 'public'
    OR public.are_friends(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "koth-videos readable by visibility" ON storage.objects;
CREATE POLICY "koth-videos readable by visibility"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'koth-videos'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.video_path = objects.name
          AND (s.visibility = 'public' OR public.are_friends(auth.uid(), s.user_id))
          AND NOT public.is_blocked_by(auth.uid(), s.user_id)
      )
    )
  );