ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'comment_video';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reply_comment';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'tag_comment';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'like_video';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'like_comment';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reply_challenge_comment';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'tag_challenge_comment';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'admin_message';