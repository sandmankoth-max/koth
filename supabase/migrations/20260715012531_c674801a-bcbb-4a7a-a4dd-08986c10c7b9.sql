
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Store the shared secret and endpoint in Supabase Vault
DO $$
DECLARE
  v_secret text := 'NrNNJ9q8ROcUKYk9SQLpHVz0PRsQm0yESY5GWW0W_m28g8DFwd5Frchf7iLBMfht';
  v_url text := 'https://xpftyvrivwwhcnlnlldu.supabase.co/functions/v1/send-push';
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_webhook_secret') THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'push_webhook_secret'),
      v_secret
    );
  ELSE
    PERFORM vault.create_secret(v_secret, 'push_webhook_secret', 'Shared secret for send-push edge function');
  END IF;

  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_webhook_url') THEN
    PERFORM vault.update_secret(
      (SELECT id FROM vault.secrets WHERE name = 'push_webhook_url'),
      v_url
    );
  ELSE
    PERFORM vault.create_secret(v_url, 'push_webhook_url', 'send-push edge function URL');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_send_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url    FROM vault.decrypted_secrets WHERE name = 'push_webhook_url'    LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret' LIMIT 1;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id', NEW.user_id,
      'type', NEW.type,
      'payload', NEW.payload
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the insert if push delivery has an issue
  RAISE WARNING 'send-push trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_send_push ON public.notifications;
CREATE TRIGGER trg_notifications_send_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trg_send_push_notification();
