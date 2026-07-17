DROP TRIGGER IF EXISTS trg_notifications_send_push ON public.notifications;
DROP FUNCTION IF EXISTS public.trg_send_push_notification();