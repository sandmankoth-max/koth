
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.push_config (
  id int PRIMARY KEY DEFAULT 1,
  webhook_url text NOT NULL,
  secret text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_config_singleton CHECK (id = 1)
);

GRANT ALL ON public.push_config TO service_role;

ALTER TABLE public.push_config ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (via GRANT) and SECURITY DEFINER functions
-- owned by postgres can read. authenticated/anon are locked out.

INSERT INTO public.push_config (id, webhook_url, secret)
VALUES (
  1,
  'https://project--c9bd69d3-6c49-4f3b-98ac-1695c2d8c121.lovable.app/api/public/send-push',
  encode(gen_random_bytes(32), 'hex')
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.notify_send_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  cfg record;
BEGIN
  SELECT webhook_url, secret, enabled INTO cfg FROM public.push_config WHERE id = 1;
  IF cfg IS NULL OR NOT cfg.enabled THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := cfg.webhook_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', cfg.secret
    ),
    body := jsonb_build_object('notification_id', NEW.id::text),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let push delivery break the notification insert.
  RAISE WARNING 'notify_send_push failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_send_push ON public.notifications;
CREATE TRIGGER notifications_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_send_push();
