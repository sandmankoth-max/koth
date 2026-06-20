
CREATE OR REPLACE FUNCTION public.admin_send_notification(p_user_id uuid, p_message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'message required';
  END IF;
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (p_user_id, 'admin_message', jsonb_build_object('message', p_message));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_send_notification(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_notification(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_broadcast_notification(p_message text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'message required';
  END IF;
  INSERT INTO public.notifications(user_id, type, payload)
  SELECT p.id, 'admin_message', jsonb_build_object('message', p_message)
  FROM public.profiles p
  WHERE coalesce(p.banned, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_broadcast_notification(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_notification(text) TO authenticated;
