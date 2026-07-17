ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text;

WITH ranked_like_videos AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, type, payload->>'submission_id', payload->>'from_user_id'
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.notifications
  WHERE type = 'like_video'
    AND payload ? 'submission_id'
    AND payload ? 'from_user_id'
)
DELETE FROM public.notifications n
USING ranked_like_videos r
WHERE n.id = r.id
  AND r.rn > 1;

WITH ranked_like_comments AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, type, payload->>'kind', payload->>'comment_id', payload->>'from_user_id'
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.notifications
  WHERE type = 'like_comment'
    AND payload ? 'kind'
    AND payload ? 'comment_id'
    AND payload ? 'from_user_id'
)
DELETE FROM public.notifications n
USING ranked_like_comments r
WHERE n.id = r.id
  AND r.rn > 1;

UPDATE public.notifications
SET dedupe_key = concat('like_video:', payload->>'submission_id', ':', payload->>'from_user_id')
WHERE type = 'like_video'
  AND payload ? 'submission_id'
  AND payload ? 'from_user_id';

UPDATE public.notifications
SET dedupe_key = concat('like_comment:', payload->>'kind', ':', payload->>'comment_id', ':', payload->>'from_user_id')
WHERE type = 'like_comment'
  AND payload ? 'kind'
  AND payload ? 'comment_id'
  AND payload ? 'from_user_id';

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key_uidx
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_video_like_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_actor_username text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.submissions SET like_count = like_count + 1 WHERE id = NEW.submission_id;
    SELECT user_id INTO v_owner FROM public.submissions WHERE id = NEW.submission_id;
    IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
      SELECT username INTO v_actor_username FROM public.profiles WHERE id = NEW.user_id;
      INSERT INTO public.notifications(user_id, type, payload, dedupe_key)
      VALUES (
        v_owner,
        'like_video',
        jsonb_build_object(
          'submission_id', NEW.submission_id,
          'from_user_id', NEW.user_id,
          'from_username', v_actor_username
        ),
        concat('like_video:', NEW.submission_id::text, ':', NEW.user_id::text)
      )
      ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL
      DO UPDATE SET
        payload = EXCLUDED.payload,
        read = false,
        created_at = EXCLUDED.created_at;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.submissions SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.submission_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END
$function$;

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
      SELECT username INTO v_actor_username FROM public.profiles WHERE id = NEW.user_id;
      INSERT INTO public.notifications(user_id, type, payload, dedupe_key)
      VALUES (
        v_author,
        'like_comment',
        jsonb_build_object(
          'kind', NEW.kind,
          'comment_id', NEW.comment_id,
          'submission_id', v_submission,
          'challenge_id', v_challenge,
          'from_user_id', NEW.user_id,
          'from_username', v_actor_username
        ),
        concat('like_comment:', NEW.kind::text, ':', NEW.comment_id::text, ':', NEW.user_id::text)
      )
      ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL
      DO UPDATE SET
        payload = EXCLUDED.payload,
        read = false,
        created_at = EXCLUDED.created_at;
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
END
$function$;