
CREATE TABLE public.user_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can file reports" ON public.user_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND reporter_id <> reported_user_id);

CREATE POLICY "reporters see their own reports" ON public.user_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.is_staff(auth.uid()));

CREATE INDEX user_reports_status_idx ON public.user_reports(status, created_at DESC);
CREATE INDEX user_reports_reported_idx ON public.user_reports(reported_user_id);

CREATE OR REPLACE FUNCTION public.submit_user_report(p_reported_user_id UUID, p_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_reason TEXT := trim(coalesce(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_reported_user_id IS NULL OR p_reported_user_id = auth.uid() THEN
    RAISE EXCEPTION 'invalid target';
  END IF;
  IF length(v_reason) < 3 THEN RAISE EXCEPTION 'Please describe the issue.'; END IF;
  IF length(v_reason) > 1000 THEN v_reason := left(v_reason, 1000); END IF;
  INSERT INTO public.user_reports(reporter_id, reported_user_id, reason)
  VALUES (auth.uid(), p_reported_user_id, v_reason)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_user_report(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_user_report(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_reports(p_status TEXT DEFAULT 'open')
RETURNS TABLE(
  id UUID,
  reporter_id UUID,
  reporter_username TEXT,
  reported_user_id UUID,
  reported_username TEXT,
  reported_avatar_url TEXT,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.reporter_id, pr.username, r.reported_user_id, pt.username, pt.avatar_url,
         r.reason, r.status, r.created_at, r.resolved_at, r.resolution_note
  FROM public.user_reports r
  LEFT JOIN public.profiles pr ON pr.id = r.reporter_id
  LEFT JOIN public.profiles pt ON pt.id = r.reported_user_id
  WHERE public.is_staff(auth.uid())
    AND (p_status IS NULL OR r.status = p_status)
  ORDER BY r.created_at DESC
  LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_reports(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.user_reports
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by = auth.uid(),
        resolution_note = nullif(trim(coalesce(p_note,'')), '')
    WHERE id = p_report_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(UUID, TEXT) TO authenticated;
