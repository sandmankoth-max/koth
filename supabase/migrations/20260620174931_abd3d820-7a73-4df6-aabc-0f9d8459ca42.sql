
-- =========================================================
-- 1. Profile bio + submission visibility
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

DO $$ BEGIN
  CREATE TYPE public.submission_visibility AS ENUM ('public', 'friends_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS visibility public.submission_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

-- =========================================================
-- 2. Friendship helper (mutual accepted)
-- =========================================================
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _a = _b OR EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = _a AND f.addressee_id = _b)
        OR (f.requester_id = _b AND f.addressee_id = _a))
  );
$$;

-- Can the viewer see this submission?
CREATE OR REPLACE FUNCTION public.can_view_submission(_viewer uuid, _submission_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = _submission_id
      AND (
        s.visibility = 'public'
        OR s.user_id = _viewer
        OR public.are_friends(_viewer, s.user_id)
      )
  );
$$;

-- =========================================================
-- 3. video_likes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.video_likes (
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.video_likes TO authenticated;
GRANT ALL ON public.video_likes TO service_role;
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view likes if can view submission"
  ON public.video_likes FOR SELECT TO authenticated
  USING (public.can_view_submission(auth.uid(), submission_id));

CREATE POLICY "like as self"
  ON public.video_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_submission(auth.uid(), submission_id));

CREATE POLICY "unlike as self"
  ON public.video_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS video_likes_submission_idx ON public.video_likes(submission_id);
CREATE INDEX IF NOT EXISTS video_likes_user_idx ON public.video_likes(user_id);

-- =========================================================
-- 4. video_comments
-- =========================================================
CREATE TABLE IF NOT EXISTS public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.video_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  tagged_user_ids uuid[] NOT NULL DEFAULT '{}',
  like_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_comments TO authenticated;
GRANT ALL ON public.video_comments TO service_role;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view comments if can view submission"
  ON public.video_comments FOR SELECT TO authenticated
  USING (public.can_view_submission(auth.uid(), submission_id));

CREATE POLICY "comment as self"
  ON public.video_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_view_submission(auth.uid(), submission_id));

CREATE POLICY "edit own comment"
  ON public.video_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

CREATE POLICY "delete own comment or admin"
  ON public.video_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS video_comments_submission_idx ON public.video_comments(submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_comments_parent_idx ON public.video_comments(parent_id);

-- =========================================================
-- 5. challenge_comments (live home-page chat)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.challenge_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.challenge_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  tagged_user_ids uuid[] NOT NULL DEFAULT '{}',
  like_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_comments TO authenticated;
GRANT ALL ON public.challenge_comments TO service_role;
ALTER TABLE public.challenge_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone signed in can read challenge comments"
  ON public.challenge_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "challenge comment as self"
  ON public.challenge_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "edit own challenge comment"
  ON public.challenge_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

CREATE POLICY "delete own challenge comment or admin"
  ON public.challenge_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS challenge_comments_idx ON public.challenge_comments(challenge_id, created_at DESC);

-- =========================================================
-- 6. comment_likes (covers both video + challenge comments via composite type)
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.comment_kind AS ENUM ('video', 'challenge');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.comment_likes (
  kind public.comment_kind NOT NULL,
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, comment_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.comment_likes TO authenticated;
GRANT ALL ON public.comment_likes TO service_role;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view comment likes"
  ON public.comment_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "like comment as self"
  ON public.comment_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "unlike comment as self"
  ON public.comment_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS comment_likes_target_idx ON public.comment_likes(kind, comment_id);

-- =========================================================
-- 7. Counter + notification triggers
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_video_like_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_actor_username text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.submissions SET like_count = like_count + 1 WHERE id = NEW.submission_id;
    SELECT user_id INTO v_owner FROM public.submissions WHERE id = NEW.submission_id;
    IF v_owner IS NOT NULL AND v_owner <> NEW.user_id THEN
      SELECT username INTO v_actor_username FROM public.profiles WHERE id = NEW.user_id;
      INSERT INTO public.notifications(user_id, type, payload)
      VALUES (v_owner, 'like_video',
        jsonb_build_object('submission_id', NEW.submission_id, 'from_user_id', NEW.user_id, 'from_username', v_actor_username));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.submissions SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.submission_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_video_likes ON public.video_likes;
CREATE TRIGGER trg_video_likes
  AFTER INSERT OR DELETE ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_video_like_counts();

CREATE OR REPLACE FUNCTION public.trg_video_comment_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_parent_author uuid;
  v_actor_username text;
  v_tagged uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.submissions SET comment_count = comment_count + 1 WHERE id = NEW.submission_id;
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE public.video_comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
      SELECT author_id INTO v_parent_author FROM public.video_comments WHERE id = NEW.parent_id;
    END IF;
    SELECT user_id INTO v_owner FROM public.submissions WHERE id = NEW.submission_id;
    SELECT username INTO v_actor_username FROM public.profiles WHERE id = NEW.author_id;

    IF NEW.parent_id IS NULL AND v_owner IS NOT NULL AND v_owner <> NEW.author_id THEN
      INSERT INTO public.notifications(user_id, type, payload)
      VALUES (v_owner, 'comment_video',
        jsonb_build_object('submission_id', NEW.submission_id, 'comment_id', NEW.id,
          'from_user_id', NEW.author_id, 'from_username', v_actor_username, 'preview', left(NEW.body, 120)));
    ELSIF NEW.parent_id IS NOT NULL AND v_parent_author IS NOT NULL AND v_parent_author <> NEW.author_id THEN
      INSERT INTO public.notifications(user_id, type, payload)
      VALUES (v_parent_author, 'reply_comment',
        jsonb_build_object('submission_id', NEW.submission_id, 'comment_id', NEW.id, 'parent_id', NEW.parent_id,
          'from_user_id', NEW.author_id, 'from_username', v_actor_username, 'preview', left(NEW.body, 120)));
    END IF;

    -- Tag notifications
    IF NEW.tagged_user_ids IS NOT NULL THEN
      FOREACH v_tagged IN ARRAY NEW.tagged_user_ids LOOP
        IF v_tagged <> NEW.author_id THEN
          INSERT INTO public.notifications(user_id, type, payload)
          VALUES (v_tagged, 'tag_comment',
            jsonb_build_object('submission_id', NEW.submission_id, 'comment_id', NEW.id,
              'from_user_id', NEW.author_id, 'from_username', v_actor_username, 'preview', left(NEW.body, 120)));
        END IF;
      END LOOP;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.submissions SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.submission_id;
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE public.video_comments SET reply_count = GREATEST(0, reply_count - 1) WHERE id = OLD.parent_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_video_comments ON public.video_comments;
CREATE TRIGGER trg_video_comments
  AFTER INSERT OR DELETE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_video_comment_counts();

CREATE OR REPLACE FUNCTION public.trg_challenge_comment_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_parent_author uuid;
  v_actor_username text;
  v_tagged uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE public.challenge_comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
      SELECT author_id INTO v_parent_author FROM public.challenge_comments WHERE id = NEW.parent_id;
    END IF;
    SELECT username INTO v_actor_username FROM public.profiles WHERE id = NEW.author_id;

    IF NEW.parent_id IS NOT NULL AND v_parent_author IS NOT NULL AND v_parent_author <> NEW.author_id THEN
      INSERT INTO public.notifications(user_id, type, payload)
      VALUES (v_parent_author, 'reply_challenge_comment',
        jsonb_build_object('challenge_id', NEW.challenge_id, 'comment_id', NEW.id, 'parent_id', NEW.parent_id,
          'from_user_id', NEW.author_id, 'from_username', v_actor_username, 'preview', left(NEW.body, 120)));
    END IF;

    IF NEW.tagged_user_ids IS NOT NULL THEN
      FOREACH v_tagged IN ARRAY NEW.tagged_user_ids LOOP
        IF v_tagged <> NEW.author_id THEN
          INSERT INTO public.notifications(user_id, type, payload)
          VALUES (v_tagged, 'tag_challenge_comment',
            jsonb_build_object('challenge_id', NEW.challenge_id, 'comment_id', NEW.id,
              'from_user_id', NEW.author_id, 'from_username', v_actor_username, 'preview', left(NEW.body, 120)));
        END IF;
      END LOOP;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE public.challenge_comments SET reply_count = GREATEST(0, reply_count - 1) WHERE id = OLD.parent_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_challenge_comments ON public.challenge_comments;
CREATE TRIGGER trg_challenge_comments
  AFTER INSERT OR DELETE ON public.challenge_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_challenge_comment_counts();

CREATE OR REPLACE FUNCTION public.trg_comment_like_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      INSERT INTO public.notifications(user_id, type, payload)
      VALUES (v_author, 'like_comment',
        jsonb_build_object('kind', NEW.kind, 'comment_id', NEW.comment_id,
          'submission_id', v_submission, 'challenge_id', v_challenge,
          'from_user_id', NEW.user_id, 'from_username', v_actor_username));
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
END $$;

DROP TRIGGER IF EXISTS trg_comment_likes ON public.comment_likes;
CREATE TRIGGER trg_comment_likes
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_comment_like_counts();
