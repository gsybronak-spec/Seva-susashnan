-- 0002_generic_event_platform.sql
-- Non-destructive generic event platform schema for Gujarat State Yog Board

CREATE TABLE IF NOT EXISTS public.event_id_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  token_id uuid NOT NULL DEFAULT gen_random_uuid(),
  access_hash text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  first_downloaded_at timestamptz,
  last_downloaded_at timestamptz,
  download_count integer NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_id_cards_registration_event_key UNIQUE (registration_id, event_id),
  CONSTRAINT event_id_cards_token_id_key UNIQUE (token_id)
);
GRANT ALL ON public.event_id_cards TO service_role;
ALTER TABLE public.event_id_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_id_cards_service_only" ON public.event_id_cards;
CREATE POLICY "event_id_cards_service_only" ON public.event_id_cards FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS event_id_cards_event_idx ON public.event_id_cards(event_id);
CREATE INDEX IF NOT EXISTS event_id_cards_registration_idx ON public.event_id_cards(registration_id);
CREATE INDEX IF NOT EXISTS event_id_cards_access_hash_idx ON public.event_id_cards(access_hash) WHERE access_hash IS NOT NULL;

DROP TRIGGER IF EXISTS event_id_cards_set_updated_at ON public.event_id_cards;
CREATE TRIGGER event_id_cards_set_updated_at BEFORE UPDATE ON public.event_id_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.event_scanners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  scanner_code text NOT NULL UNIQUE,
  scanner_name text NOT NULL,
  operator_name text NOT NULL,
  secret_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  created_by uuid REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  last_activity_at timestamptz,
  total_scans integer NOT NULL DEFAULT 0 CHECK (total_scans >= 0),
  duplicate_attempts integer NOT NULL DEFAULT 0 CHECK (duplicate_attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.event_scanners TO service_role;
ALTER TABLE public.event_scanners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_scanners_service_only" ON public.event_scanners;
CREATE POLICY "event_scanners_service_only" ON public.event_scanners FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS event_scanners_event_status_idx ON public.event_scanners(event_id, is_active, revoked_at);

DROP TRIGGER IF EXISTS event_scanners_set_updated_at ON public.event_scanners;
CREATE TRIGGER event_scanners_set_updated_at BEFORE UPDATE ON public.event_scanners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS registration_id uuid REFERENCES public.registrations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS scanner_id uuid REFERENCES public.event_scanners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS ip text;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_event_registration_unique
  ON public.attendance(event_id, registration_id)
  WHERE event_id IS NOT NULL
    AND registration_id IS NOT NULL
    AND check_in_method IN ('qr', 'manual');

CREATE INDEX IF NOT EXISTS attendance_event_method_time_idx ON public.attendance(event_id, check_in_method, check_in_time DESC);
CREATE INDEX IF NOT EXISTS attendance_event_scanner_time_idx ON public.attendance(scanner_id, check_in_time DESC) WHERE scanner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.event_checkin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  scanner_id uuid REFERENCES public.event_scanners(id) ON DELETE SET NULL,
  checked_in_by text,
  method text NOT NULL CHECK (method IN ('qr', 'manual')),
  result text NOT NULL CHECK (result IN ('success', 'duplicate', 'invalid_qr', 'not_registered', 'scanner_inactive', 'scanner_revoked', 'unauthorized', 'cross_event')),
  payload_hash text,
  ip text,
  user_agent text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.event_checkin_attempts TO service_role;
ALTER TABLE public.event_checkin_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_checkin_attempts_service_only" ON public.event_checkin_attempts;
CREATE POLICY "event_checkin_attempts_service_only" ON public.event_checkin_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS event_checkin_attempts_event_time_idx ON public.event_checkin_attempts(event_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS event_checkin_attempts_scanner_time_idx ON public.event_checkin_attempts(scanner_id, attempted_at DESC) WHERE scanner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_checkin_attempts_result_idx ON public.event_checkin_attempts(event_id, result);

CREATE TABLE IF NOT EXISTS public.certificate_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
  certificate_issue_id uuid REFERENCES public.certificate_issues(id) ON DELETE SET NULL,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);
GRANT SELECT, INSERT ON public.certificate_downloads TO service_role;
ALTER TABLE public.certificate_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "certificate_downloads_service_only" ON public.certificate_downloads;
CREATE POLICY "certificate_downloads_service_only" ON public.certificate_downloads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS certificate_downloads_event_time_idx ON public.certificate_downloads(event_id, downloaded_at DESC);

CREATE OR REPLACE FUNCTION public.record_event_checkin(
  _event_id uuid,
  _registration_id uuid,
  _method text,
  _scanner_id uuid DEFAULT NULL,
  _checked_in_by text DEFAULT NULL,
  _payload_hash text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _user_agent text DEFAULT NULL
) RETURNS TABLE(result text, attendance_id uuid, original_check_in timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registration public.registrations%ROWTYPE;
  v_scanner public.event_scanners%ROWTYPE;
  v_attendance_id uuid;
  v_original timestamptz;
  v_result text;
BEGIN
  IF _method NOT IN ('qr', 'manual') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;

  SELECT * INTO v_registration FROM public.registrations
   WHERE id = _registration_id AND event_id = _event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_registered';
  END IF;

  IF _method = 'qr' THEN
    IF _scanner_id IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
    SELECT * INTO v_scanner FROM public.event_scanners
     WHERE id = _scanner_id AND event_id = _event_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'unauthorized'; END IF;
    IF v_scanner.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'scanner_revoked'; END IF;
    IF v_scanner.is_active IS NOT TRUE THEN RAISE EXCEPTION 'scanner_inactive'; END IF;
  ELSIF _checked_in_by IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  BEGIN
    INSERT INTO public.attendance (
      registration_number, full_name, mobile, event_id, district_id,
      registration_id, check_in_method, scanner_id, checked_in_by,
      status, check_in_time, user_agent, ip
    ) VALUES (
      v_registration.registration_number, v_registration.full_name, v_registration.mobile,
      _event_id, v_registration.district_id, v_registration.id, _method,
      _scanner_id, _checked_in_by,
      'checked_in', now(), left(coalesce(_user_agent, ''), 500), _ip
    ) RETURNING id, check_in_time INTO v_attendance_id, v_original;
    v_result := 'success';
  EXCEPTION WHEN unique_violation THEN
    SELECT id, check_in_time INTO v_attendance_id, v_original
      FROM public.attendance
     WHERE event_id = _event_id AND registration_id = _registration_id
       AND check_in_method IN ('qr', 'manual')
     LIMIT 1;
    v_result := 'duplicate';
  END;

  INSERT INTO public.event_checkin_attempts (
    event_id, registration_id, scanner_id, checked_in_by, method, result,
    payload_hash, ip, user_agent
  ) VALUES (
    _event_id, _registration_id, _scanner_id, _checked_in_by, _method, v_result,
    _payload_hash, _ip, left(coalesce(_user_agent, ''), 500)
  );

  IF _scanner_id IS NOT NULL THEN
    UPDATE public.event_scanners SET
      last_activity_at = now(),
      total_scans = total_scans + CASE WHEN v_result = 'success' THEN 1 ELSE 0 END,
      duplicate_attempts = duplicate_attempts + CASE WHEN v_result = 'duplicate' THEN 1 ELSE 0 END
    WHERE id = _scanner_id;
  END IF;

  RETURN QUERY SELECT v_result, v_attendance_id, v_original;
END;
$$;
REVOKE ALL ON FUNCTION public.record_event_checkin(uuid, uuid, text, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_event_checkin(uuid, uuid, text, uuid, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.event_overview_stats(_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH
  registrations_scoped AS (
    SELECT id, custom_fields, district
    FROM public.registrations
    WHERE event_id = _event_id
  ),
  attendance_scoped AS (
    SELECT registration_id, check_in_method
    FROM public.attendance
    WHERE event_id = _event_id
      AND check_in_method IN ('qr', 'manual')
  ),
  totals AS (
    SELECT
      (SELECT count(*) FROM registrations_scoped)::int AS registered,
      (SELECT count(*) FROM public.event_id_cards WHERE event_id = _event_id)::int AS id_cards,
      (SELECT count(*) FROM attendance_scoped)::int AS checked_in,
      (SELECT count(*) FROM attendance_scoped WHERE check_in_method = 'qr')::int AS qr,
      (SELECT count(*) FROM attendance_scoped WHERE check_in_method = 'manual')::int AS manual,
      (SELECT count(*) FROM public.event_checkin_attempts WHERE event_id = _event_id AND result = 'duplicate')::int AS duplicate_attempts,
      (SELECT count(*) FROM public.certificate_downloads WHERE event_id = _event_id)::int AS certificate_downloads
  ),
  participant_types AS (
    SELECT
      coalesce(nullif(r.custom_fields->>'participant_type', ''), 'Standard') AS p_type,
      count(*)::int AS registered,
      count(a.registration_id)::int AS attended
    FROM registrations_scoped r
    LEFT JOIN attendance_scoped a ON a.registration_id = r.id
    GROUP BY 1
  ),
  zones AS (
    SELECT
      coalesce(nullif(r.custom_fields->>'zone', ''), nullif(r.district, ''), 'All') AS loc,
      count(*)::int AS registered,
      count(a.registration_id)::int AS attended
    FROM registrations_scoped r
    LEFT JOIN attendance_scoped a ON a.registration_id = r.id
    GROUP BY 1
  )
SELECT jsonb_build_object(
  'registered', t.registered,
  'id_cards', t.id_cards,
  'checked_in', t.checked_in,
  'pending', greatest(0, t.registered - t.checked_in),
  'attendance_pct', CASE WHEN t.registered = 0 THEN 0 ELSE round((t.checked_in::numeric / t.registered::numeric) * 100, 1) END,
  'qr', t.qr,
  'manual', t.manual,
  'duplicate_attempts', t.duplicate_attempts,
  'certificate_eligible', t.checked_in,
  'certificate_downloads', t.certificate_downloads,
  'by_type', coalesce((SELECT jsonb_agg(jsonb_build_object('type', p_type, 'registered', registered, 'attended', attended) ORDER BY registered DESC) FROM participant_types), '[]'::jsonb),
  'by_zone', coalesce((SELECT jsonb_agg(jsonb_build_object('zone', loc, 'registered', registered, 'attended', attended) ORDER BY registered DESC) FROM zones), '[]'::jsonb)
)
FROM totals t;
$$;
REVOKE ALL ON FUNCTION public.event_overview_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_overview_stats(uuid) TO service_role;

-- Backfill event_id_cards for existing registrations
INSERT INTO public.event_id_cards (event_id, registration_id, access_hash)
SELECT r.event_id, r.id, encode(digest(r.id::text || '-initial-access', 'sha256'), 'hex')
FROM public.registrations r
WHERE r.event_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.event_id_cards c WHERE c.registration_id = r.id
  );
