-- ============================================================
-- Yog Board Portal — FRESH INSTALL SCHEMA (consolidated)
--
-- This file consolidates the 48 sequential migrations of the
-- original project into a single idempotent bootstrap for a NEW
-- Supabase project. Run once via 'supabase db push' or the SQL
-- Editor. Safe to re-run (all statements are IF NOT EXISTS /
-- OR REPLACE / ON CONFLICT guarded).
-- ============================================================

-- ---------- source migration: 20260709122800_7e1fa4b9-47a3-4e85-8bee-09f65a002e18.sql ----------

CREATE SEQUENCE IF NOT EXISTS public.registration_seq START 1;

CREATE TABLE public.registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  village TEXT NOT NULL,
  address TEXT NOT NULL,
  taluka TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT 'Junagadh',
  designation TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  referral_by TEXT,
  certificate_available BOOLEAN NOT NULL DEFAULT FALSE,
  certificate_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_registrations_referral_by ON public.registrations(referral_by);
CREATE INDEX idx_registrations_mobile ON public.registrations(mobile);
CREATE INDEX idx_registrations_regno ON public.registrations(registration_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- No policies => no direct client access. All access via server functions with service role or public certificate lookup.
-- Public certificate lookup done via server function; no direct anon access needed.

CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('public.registration_seq');
  RETURN 'SSA' || lpad(next_val::text, 6, '0');
END;
$$;


-- ---------- source migration: 20260709123828_de291eeb-48fc-466d-82ab-f1dcdcf4dbfc.sql ----------
CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('public.registration_seq');
  RETURN 'JND' || lpad(next_val::text, 4, '0');
END;
$$;

-- ---------- source migration: 20260709125115_b6624536-8ac5-4f67-90de-c72b5bfb1631.sql ----------
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read settings"
  ON public.app_settings FOR SELECT
  USING (true);

INSERT INTO public.app_settings (key, value)
VALUES ('certificates_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------- source migration: 20260710065812_b00cb07d-22eb-4768-aefc-a58674fd114f.sql ----------

-- Rename referral_by to referred_by for clarity
ALTER TABLE public.registrations RENAME COLUMN referral_by TO referred_by;

-- Ensure unique constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='registrations_mobile_key') THEN
    ALTER TABLE public.registrations ADD CONSTRAINT registrations_mobile_key UNIQUE (mobile);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='registrations_registration_number_key') THEN
    ALTER TABLE public.registrations ADD CONSTRAINT registrations_registration_number_key UNIQUE (registration_number);
  END IF;
END $$;

-- Update generator to produce SSA000001 format (6-digit zero-padded)
CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('public.registration_seq');
  RETURN 'SSA' || lpad(next_val::text, 6, '0');
END;
$function$;

-- Grants
GRANT INSERT ON public.registrations TO anon;
GRANT INSERT ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;

-- Ensure RLS enabled
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Drop old policies if any, then create new ones
DROP POLICY IF EXISTS "Public can insert registrations" ON public.registrations;
DROP POLICY IF EXISTS "Public cannot read registrations" ON public.registrations;

-- Allow anyone (anon + authenticated) to INSERT
CREATE POLICY "Public can insert registrations"
  ON public.registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No SELECT policy = public cannot read (RLS blocks by default).
-- Admin server functions use the service role which bypasses RLS.


-- ---------- source migration: 20260710070435_08300058-6262-4390-8744-b1f55e4bc129.sql ----------
-- Tighten INSERT policy on registrations to add validation checks instead of WITH CHECK (true).
-- Also add an explicit deny-all SELECT policy for anon/authenticated (defense-in-depth; reads happen server-side via service role).

DROP POLICY IF EXISTS "Public can insert registrations" ON public.registrations;

CREATE POLICY "Public can insert validated registrations"
ON public.registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(full_name) BETWEEN 2 AND 120
  AND mobile ~ '^[6-9][0-9]{9}$'
  AND length(address) BETWEEN 3 AND 400
  AND length(village) BETWEEN 1 AND 120
  AND length(taluka) BETWEEN 1 AND 120
  AND length(district) BETWEEN 1 AND 120
  AND designation IN ('Yoga Coach','Yoga Trainer','Yoga Sadhak','Other')
  AND registration_number ~ '^SSA[0-9]{6}$'
  AND (referred_by IS NULL OR referred_by ~ '^SSA[0-9]{6}$')
  AND certificate_available = false
  AND certificate_url IS NULL
);

-- Explicit no-op SELECT policy documenting that public reads are forbidden.
-- Since no SELECT policy grants access, all reads via anon/authenticated remain denied.
-- (Server-side admin reads use the service role which bypasses RLS.)
CREATE POLICY "Deny public reads"
ON public.registrations
FOR SELECT
TO anon, authenticated
USING (false);

-- ---------- source migration: 20260710074943_83fa04e7-2e37-40ec-818b-b08fe6ef788c.sql ----------

-- Webinar configuration table (single-row pattern with is_active)
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  general jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  live jsonb NOT NULL DEFAULT '{}'::jsonb,
  attendance jsonb NOT NULL DEFAULT '{}'::jsonb,
  certificate jsonb NOT NULL DEFAULT '{}'::jsonb,
  referral jsonb NOT NULL DEFAULT '{}'::jsonb,
  whatsapp jsonb NOT NULL DEFAULT '{}'::jsonb,
  social jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.events TO anon, authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read event config"
  ON public.events FOR SELECT
  TO anon, authenticated
  USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed one active row with sensible defaults reflecting the current site
INSERT INTO public.events (is_active, general, features, live, attendance, certificate, referral, whatsapp, social)
VALUES (
  true,
  jsonb_build_object(
    'title', 'Online Yoga Webinar',
    'subtitle', 'State Yog Board',
    'theme', 'Transform Your Life Through Yoga',
    'description', 'Join the Yog ane Dhyan Shibir organized by Seva Sushasan Abhiyan and begin your journey towards a healthier and happier life.',
    'banner_url', '',
    'registration_open_at', null,
    'registration_close_at', null,
    'event_date', null,
    'start_time', null,
    'end_time', null,
    'duration_minutes', 60,
    'speaker_name', '',
    'speaker_designation', ''
  ),
  jsonb_build_object(
    'show_details', true,
    'registration', true,
    'live', false,
    'attendance', false,
    'certificate', false,
    'referral', true,
    'whatsapp', false,
    'social', false,
    'countdown', true,
    'footer', true,
    'embedded_live', true,
    'backup_live', false
  ),
  jsonb_build_object(
    'primary_url', '',
    'backup_url', '',
    'primary_button_text', 'Join Live Webinar',
    'backup_button_text', 'Join Backup Stream',
    'enable_primary', true,
    'enable_backup', false,
    'enable_embedded', true,
    'enable_open_youtube', true
  ),
  jsonb_build_object(
    'min_percent', 70,
    'interval_seconds', 30,
    'start_buffer_minutes', 5,
    'end_buffer_minutes', 5,
    'enable_tracking', false,
    'enable_report', false,
    'enable_live_dashboard', false
  ),
  jsonb_build_object(
    'enabled', false,
    'title', 'Certificate of Participation',
    'subtitle', 'Online Yoga Webinar',
    'background_url', '',
    'signature_url', '',
    'authorized_name', '',
    'qr_url', '',
    'prefix', 'SSA',
    'approval_mode', 'manual',
    'attendance_required', true
  ),
  jsonb_build_object(
    'enabled', true,
    'share_template', E'Join the Official Online Yoga Webinar organized by State Yog Board.\n\nTheme: {{Theme}}\nDate: {{Date}}\nTime: {{Time}}\n\nRegister Here: {{Link}}'
  ),
  jsonb_build_object(
    'enabled', false,
    'url', '',
    'button_text', 'Join Our WhatsApp Channel'
  ),
  jsonb_build_object(
    'facebook',        jsonb_build_object('enabled', false, 'url', ''),
    'instagram',       jsonb_build_object('enabled', false, 'url', ''),
    'youtube',         jsonb_build_object('enabled', false, 'url', ''),
    'telegram',        jsonb_build_object('enabled', false, 'url', ''),
    'whatsapp_channel',jsonb_build_object('enabled', false, 'url', ''),
    'twitter',         jsonb_build_object('enabled', false, 'url', ''),
    'website',         jsonb_build_object('enabled', false, 'url', '')
  )
);


-- ---------- source migration: 20260710075651_f92fd2b1-1fc9-4b14-a5d6-8d9127b2e684.sql ----------

-- Registrations: explicit deny UPDATE/DELETE for anon/authenticated (service_role bypasses RLS)
CREATE POLICY "Deny public updates"
  ON public.registrations FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny public deletes"
  ON public.registrations FOR DELETE
  TO anon, authenticated
  USING (false);

-- Webinar config: remove public read; backend server functions use service role
DROP POLICY IF EXISTS "Public can read event config" ON public.events;
REVOKE SELECT ON public.events FROM anon, authenticated;

-- App settings: remove public read; backend server functions use service role
DROP POLICY IF EXISTS "Public can read settings" ON public.app_settings;
REVOKE SELECT ON public.app_settings FROM anon, authenticated;


-- ---------- source migration: 20260710075709_e294562d-6cd4-4c03-83cf-6d70de33fa18.sql ----------

CREATE POLICY "Deny public reads" ON public.events
  FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "Deny public reads" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (false);


-- ---------- source migration: 20260710115826_46e0754f-9261-493a-941f-3ea70b57d5e7.sql ----------

-- 1. Update INSERT policy to drop address requirement and allow empty taluka
DROP POLICY IF EXISTS "Public can insert validated registrations" ON public.registrations;

-- 2. Drop the address column
ALTER TABLE public.registrations DROP COLUMN IF EXISTS address;

-- 3. Make taluka optional
ALTER TABLE public.registrations ALTER COLUMN taluka DROP NOT NULL;

-- 4. Recreate INSERT policy without address; taluka optional
CREATE POLICY "Public can insert validated registrations"
  ON public.registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(full_name) >= 2 AND length(full_name) <= 120
    AND mobile ~ '^[6-9][0-9]{9}$'
    AND length(village) >= 1 AND length(village) <= 120
    AND (taluka IS NULL OR length(taluka) <= 120)
    AND length(district) >= 1 AND length(district) <= 120
    AND designation = ANY (ARRAY['Yoga Coach'::text, 'Yoga Trainer'::text, 'Yoga Sadhak'::text, 'Other'::text])
    AND registration_number ~ '^SSA[0-9]{6}$'
    AND (referred_by IS NULL OR referred_by ~ '^SSA[0-9]{6}$')
    AND certificate_available = false
    AND certificate_url IS NULL
  );


-- ---------- source migration: 20260710121645_4f1b51ed-cdb4-48f3-aacf-b6d9e7a7f9d2.sql ----------
-- 1. Extend registrations for custom field answers
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Extend events with new JSONB sections (status, demo_mode, form)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS status JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS demo_mode JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS form JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  registration_number TEXT NOT NULL,
  full_name TEXT,
  mobile TEXT,
  -- Physical check-in model (Yog ane Dhyan Shibir on-site camps):
  -- one row per participant per event. The UNIQUE constraint below
  -- makes duplicate check-in IMPOSSIBLE at the database level.
  status TEXT NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in')),
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_method TEXT NOT NULL DEFAULT 'qr' CHECK (check_in_method IN ('qr', 'manual')),
  checked_in_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendance_event_reg_unique UNIQUE (event_id, registration_number)
);

CREATE INDEX IF NOT EXISTS idx_attendance_reg ON public.attendance(registration_number);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in_time ON public.attendance(check_in_time);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Deny anon/authenticated direct access; all reads/writes go through server functions (service role).
CREATE POLICY "Deny public reads on attendance"
  ON public.attendance FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public inserts on attendance"
  ON public.attendance FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public updates on attendance"
  ON public.attendance FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public deletes on attendance"
  ON public.attendance FOR DELETE TO anon, authenticated USING (false);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_attendance_updated_at ON public.attendance;
CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------- source migration: 20260710124653_7208f6a9-52d1-42bb-8693-5d5dbe6aee75.sql ----------
ALTER TABLE public.registrations ALTER COLUMN village DROP NOT NULL;
ALTER TABLE public.registrations ALTER COLUMN designation DROP NOT NULL;
ALTER TABLE public.registrations ALTER COLUMN district DROP NOT NULL;

-- ---------- source migration: 20260710154910_0e49da4a-c34a-4876-a67a-a47059f225b9.sql ----------
-- Explicitly block anon + authenticated access to the private `certificates` bucket.
-- Certificate files are only produced and served by server-side code (service_role),
-- which bypasses RLS. Users access files exclusively via short-lived signed URLs.

DROP POLICY IF EXISTS "certificates_no_anon_select" ON storage.objects;
DROP POLICY IF EXISTS "certificates_no_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "certificates_no_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "certificates_no_anon_delete" ON storage.objects;
DROP POLICY IF EXISTS "certificates_no_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "certificates_no_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "certificates_no_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "certificates_no_auth_delete" ON storage.objects;

CREATE POLICY "certificates_no_anon_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id <> 'certificates');
CREATE POLICY "certificates_no_anon_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id <> 'certificates');
CREATE POLICY "certificates_no_anon_update" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id <> 'certificates') WITH CHECK (bucket_id <> 'certificates');
CREATE POLICY "certificates_no_anon_delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id <> 'certificates');

CREATE POLICY "certificates_no_auth_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id <> 'certificates');
CREATE POLICY "certificates_no_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id <> 'certificates');
CREATE POLICY "certificates_no_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id <> 'certificates') WITH CHECK (bucket_id <> 'certificates');
CREATE POLICY "certificates_no_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id <> 'certificates');

-- ---------- source migration: 20260711081341_a2f395b8-ad69-4ac0-a4a2-448ea1b36159.sql ----------

-- ============================================================
-- Phase 1: Multi-event foundation
-- ============================================================

-- 1. Extend events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'upcoming'
    CHECK (lifecycle_status IN ('upcoming','live','completed','cancelled','archived')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS registration_open_at timestamptz,
  ADD COLUMN IF NOT EXISTS registration_close_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_registrations integer;

-- Backfill slugs for existing rows
UPDATE public.events
SET slug = 'event-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_key ON public.events(slug);

-- Enforce single active event
CREATE OR REPLACE FUNCTION public.enforce_single_active_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active THEN
    UPDATE public.events
      SET is_active = false
      WHERE id <> NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_active_event ON public.events;
CREATE TRIGGER trg_single_active_event
  AFTER INSERT OR UPDATE OF is_active ON public.events
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.enforce_single_active_event();

-- 2. Add event_id to registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE RESTRICT;

-- Backfill to current active event (or any first event if none active)
UPDATE public.registrations r
SET event_id = COALESCE(
  (SELECT id FROM public.events WHERE is_active = true LIMIT 1),
  (SELECT id FROM public.events ORDER BY created_at LIMIT 1)
)
WHERE r.event_id IS NULL;

-- Change mobile uniqueness: allow same mobile across different events
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_mobile_key;
CREATE UNIQUE INDEX IF NOT EXISTS registrations_event_mobile_key
  ON public.registrations(event_id, mobile);

CREATE INDEX IF NOT EXISTS idx_registrations_event ON public.registrations(event_id);

-- 3. Add event_id to attendance
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE RESTRICT;

UPDATE public.attendance a
SET event_id = COALESCE(
  (SELECT id FROM public.events WHERE is_active = true LIMIT 1),
  (SELECT id FROM public.events ORDER BY created_at LIMIT 1)
)
WHERE a.event_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_event ON public.attendance(event_id);

-- (Heartbeat-based online attendance metrics removed — physical check-in
-- model applies for on-site Yog ane Dhyan Shibir camps.)

-- 4. event_notices
CREATE TABLE IF NOT EXISTS public.event_notices (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('top_banner','popup','emergency','registration_closing','certificate_available')),
  title text,
  body text,
  enabled boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_notices TO anon, authenticated;
GRANT ALL ON public.event_notices TO service_role;

ALTER TABLE public.event_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active event notices"
  ON public.event_notices FOR SELECT
  TO anon, authenticated
  USING (
    enabled = true
    AND event_id IN (SELECT id FROM public.events WHERE is_active = true)
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

CREATE TRIGGER trg_event_notices_updated_at
  BEFORE UPDATE ON public.event_notices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_event_notices_event ON public.event_notices(event_id);

-- 5. event_broadcasts
CREATE TABLE IF NOT EXISTS public.event_broadcasts (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('announcement','reminder','certificate_available','upcoming_event')),
  title text NOT NULL,
  body text,
  surfaces text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_broadcasts TO anon, authenticated;
GRANT ALL ON public.event_broadcasts TO service_role;

ALTER TABLE public.event_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active event broadcasts"
  ON public.event_broadcasts FOR SELECT
  TO anon, authenticated
  USING (
    enabled = true
    AND event_id IN (SELECT id FROM public.events WHERE is_active = true)
  );

CREATE TRIGGER trg_event_broadcasts_updated_at
  BEFORE UPDATE ON public.event_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_event_broadcasts_event ON public.event_broadcasts(event_id);

-- 6. certificate_templates
CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  background_url text,
  elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.certificate_templates TO service_role;

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

-- No public policies: templates are read via server functions using service role.

CREATE TRIGGER trg_certificate_templates_updated_at
  BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS certificate_templates_default_per_event
  ON public.certificate_templates(event_id) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_certificate_templates_event ON public.certificate_templates(event_id);

-- 7. site_settings (singleton)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  name text,
  logo_url text,
  favicon_url text,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  footer jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton_unique UNIQUE (singleton)
);

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads site settings"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.site_settings (singleton, name)
  VALUES (true, 'State Yog Board')
  ON CONFLICT (singleton) DO NOTHING;


-- ---------- source migration: 20260711081402_2ea39be5-6925-472a-8e43-fbf644b04d05.sql ----------

CREATE POLICY "Deny public reads on certificate_templates"
  ON public.certificate_templates FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "Deny public inserts on certificate_templates"
  ON public.certificate_templates FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny public updates on certificate_templates"
  ON public.certificate_templates FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny public deletes on certificate_templates"
  ON public.certificate_templates FOR DELETE TO anon, authenticated USING (false);


-- ---------- source migration: 20260711083942_0fa5648c-17aa-4001-abe0-6286df870082.sql ----------

-- Sequence backing certificate numbers
CREATE SEQUENCE IF NOT EXISTS public.certificate_number_seq START 1;

-- Issued certificates table (one row per participant per event)
CREATE TABLE IF NOT EXISTS public.certificate_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  registration_number text NOT NULL,
  full_name text NOT NULL,
  mobile text NOT NULL,
  certificate_number text NOT NULL UNIQUE,
  template_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','issued')),
  attendance_pct integer,
  issued_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.certificate_issues TO anon;
GRANT SELECT ON public.certificate_issues TO authenticated;
GRANT ALL ON public.certificate_issues TO service_role;

ALTER TABLE public.certificate_issues ENABLE ROW LEVEL SECURITY;

-- Public verification: only issued/approved rows readable
DROP POLICY IF EXISTS "Public can verify issued certificates" ON public.certificate_issues;
CREATE POLICY "Public can verify issued certificates"
  ON public.certificate_issues FOR SELECT
  TO anon, authenticated
  USING (status IN ('approved','issued'));

CREATE INDEX IF NOT EXISTS cert_issues_mobile_idx ON public.certificate_issues(mobile);
CREATE INDEX IF NOT EXISTS cert_issues_regno_idx ON public.certificate_issues(registration_number);
CREATE INDEX IF NOT EXISTS cert_issues_event_idx ON public.certificate_issues(event_id);

DROP TRIGGER IF EXISTS certificate_issues_set_updated_at ON public.certificate_issues;
CREATE TRIGGER certificate_issues_set_updated_at
  BEFORE UPDATE ON public.certificate_issues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------- source migration: 20260711085507_8bd755d5-05f2-49b5-8ff0-956f5249dc04.sql ----------
-- Remove broad public SELECT on certificate_issues; verification is done via server functions using service role.
DROP POLICY IF EXISTS "Public can verify issued certificates" ON public.certificate_issues;

-- Clean up confusing negative-only storage policies on the private 'certificates' bucket.
-- The bucket remains private (fail-closed); server code uses the service role which bypasses RLS.
DROP POLICY IF EXISTS certificates_no_anon_delete ON storage.objects;
DROP POLICY IF EXISTS certificates_no_anon_insert ON storage.objects;
DROP POLICY IF EXISTS certificates_no_anon_select ON storage.objects;
DROP POLICY IF EXISTS certificates_no_anon_update ON storage.objects;
DROP POLICY IF EXISTS certificates_no_auth_delete ON storage.objects;
DROP POLICY IF EXISTS certificates_no_auth_insert ON storage.objects;
DROP POLICY IF EXISTS certificates_no_auth_select ON storage.objects;
DROP POLICY IF EXISTS certificates_no_auth_update ON storage.objects;

-- ---------- source migration: 20260713113210_77b7b841-8b7e-43f0-a891-1d24a1773769.sql ----------

-- Role enum
DO $$ BEGIN
  CREATE TYPE public.admin_role AS ENUM ('super_admin', 'view_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role public.admin_role NOT NULL DEFAULT 'view_admin',
  disabled BOOLEAN NOT NULL DEFAULT false,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only service_role reaches this table (server-side admin panel).
GRANT ALL ON public.admin_users TO service_role;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated => browser cannot read or write.
CREATE POLICY "admin_users deny anon"
  ON public.admin_users FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Update trigger
DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default accounts (idempotent)
INSERT INTO public.admin_users (username, role, disabled, must_change_password)
VALUES ('superadmin', 'super_admin', false, true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.admin_users (username, role, disabled, must_change_password)
VALUES ('vieweradmin', 'view_admin', true, true)
ON CONFLICT (username) DO NOTHING;

-- ============ Production data cleanup ============
DELETE FROM public.attendance;
DELETE FROM public.certificate_issues;
DELETE FROM public.registrations;

-- Reset registration sequence so the first real participant gets SSA000001
ALTER SEQUENCE public.registration_seq RESTART WITH 1;


-- ---------- source migration: 20260714093929_2fb602f5-ec99-4172-b237-049e99694272.sql ----------
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS age integer;

-- ---------- source migration: 20260714104214_4bbb5bb0-25c3-4e06-bee2-030ee51e0699.sql ----------
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS age_group text GENERATED ALWAYS AS (
  CASE
    WHEN age IS NULL THEN NULL
    WHEN age < 18 THEN 'Below 18'
    WHEN age <= 35 THEN '18-35'
    WHEN age <= 50 THEN '36-50'
    ELSE 'Above 50'
  END
) STORED;

-- ---------- source migration: 20260716145821_8dd0a126-825d-4c0a-a988-7981e9d02328.sql ----------

CREATE OR REPLACE FUNCTION public.registration_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  totals AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
      count(*) FILTER (WHERE referred_by IS NOT NULL)::int AS total_referrals
    FROM public.registrations
  ),
  by_designation AS (
    SELECT coalesce(designation, 'Other') AS k, count(*)::int AS c
    FROM public.registrations GROUP BY 1
  ),
  by_gender AS (
    SELECT coalesce(gender, 'Unspecified') AS k, count(*)::int AS c
    FROM public.registrations GROUP BY 1
  ),
  by_age AS (
    SELECT coalesce(age_group, 'Unspecified') AS k, count(*)::int AS c
    FROM public.registrations GROUP BY 1
  ),
  leaderboard AS (
    SELECT r.referred_by AS registration_number,
           coalesce(ref.full_name, '—') AS full_name,
           count(*)::int AS count
    FROM public.registrations r
    LEFT JOIN public.registrations ref
      ON ref.registration_number = r.referred_by
    WHERE r.referred_by IS NOT NULL
    GROUP BY r.referred_by, ref.full_name
    ORDER BY count DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'total', (SELECT total FROM totals),
    'today', (SELECT today FROM totals),
    'totalReferrals', (SELECT total_referrals FROM totals),
    'byDesignation', (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_designation),
    'byGender',      (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_gender),
    'byAgeGroup',    (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_age),
    'leaderboard',   (SELECT coalesce(jsonb_agg(l), '[]'::jsonb) FROM leaderboard l)
  );
$$;

REVOKE ALL ON FUNCTION public.registration_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registration_stats() TO service_role;

-- Supporting indexes for aggregate scans and today filter
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON public.registrations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_designation ON public.registrations (designation);
CREATE INDEX IF NOT EXISTS idx_registrations_gender ON public.registrations (gender);
CREATE INDEX IF NOT EXISTS idx_registrations_age_group ON public.registrations (age_group);


-- ---------- source migration: 20260717074010_81a9468e-1428-4e26-aa37-37ac26a7ff58.sql ----------

-- 1. Partners table
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  partner_name TEXT NOT NULL,
  organization TEXT,
  contact_person TEXT,
  mobile TEXT,
  email TEXT,
  district TEXT,
  taluka TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  link_disabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages partners"
  ON public.partners FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER partners_set_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_partners_slug ON public.partners(slug);
CREATE INDEX idx_partners_status ON public.partners(status);

-- 2. Add partner columns to registrations
ALTER TABLE public.registrations
  ADD COLUMN partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN partner_name TEXT;

CREATE INDEX idx_registrations_partner_id ON public.registrations(partner_id);

-- 3. Add can_view_partners flag on admin users
ALTER TABLE public.admin_users
  ADD COLUMN can_view_partners BOOLEAN NOT NULL DEFAULT false;

-- 4. Update stats function to include partner totals
CREATE OR REPLACE FUNCTION public.registration_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH
  totals AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
      count(*) FILTER (WHERE referred_by IS NOT NULL)::int AS total_referrals,
      count(*) FILTER (WHERE partner_id IS NOT NULL)::int AS partner_registrations
    FROM public.registrations
  ),
  by_designation AS (
    SELECT coalesce(designation, 'Other') AS k, count(*)::int AS c
    FROM public.registrations GROUP BY 1
  ),
  by_gender AS (
    SELECT coalesce(gender, 'Unspecified') AS k, count(*)::int AS c
    FROM public.registrations GROUP BY 1
  ),
  by_age AS (
    SELECT coalesce(age_group, 'Unspecified') AS k, count(*)::int AS c
    FROM public.registrations GROUP BY 1
  ),
  leaderboard AS (
    SELECT r.referred_by AS registration_number,
           coalesce(ref.full_name, '—') AS full_name,
           count(*)::int AS count
    FROM public.registrations r
    LEFT JOIN public.registrations ref
      ON ref.registration_number = r.referred_by
    WHERE r.referred_by IS NOT NULL
    GROUP BY r.referred_by, ref.full_name
    ORDER BY count DESC
    LIMIT 10
  ),
  partner_leaderboard AS (
    SELECT p.id, p.slug, p.partner_name, count(r.*)::int AS count
    FROM public.partners p
    LEFT JOIN public.registrations r ON r.partner_id = p.id
    GROUP BY p.id, p.slug, p.partner_name
    ORDER BY count DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'total', (SELECT total FROM totals),
    'today', (SELECT today FROM totals),
    'totalReferrals', (SELECT total_referrals FROM totals),
    'partnerRegistrations', (SELECT partner_registrations FROM totals),
    'byDesignation', (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_designation),
    'byGender',      (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_gender),
    'byAgeGroup',    (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_age),
    'leaderboard',   (SELECT coalesce(jsonb_agg(l), '[]'::jsonb) FROM leaderboard l),
    'partnerLeaderboard', (SELECT coalesce(jsonb_agg(p), '[]'::jsonb) FROM partner_leaderboard p)
  );
$function$;

-- 5. Per-partner stats function
CREATE OR REPLACE FUNCTION public.partner_stats(_partner_id UUID)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH src AS (
    SELECT * FROM public.registrations WHERE partner_id = _partner_id
  ),
  totals AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today
    FROM src
  ),
  by_gender AS (
    SELECT coalesce(gender, 'Unspecified') AS k, count(*)::int AS c FROM src GROUP BY 1
  ),
  by_age AS (
    SELECT coalesce(age_group, 'Unspecified') AS k, count(*)::int AS c FROM src GROUP BY 1
  ),
  by_district AS (
    SELECT coalesce(district, 'Unspecified') AS k, count(*)::int AS c FROM src GROUP BY 1
  ),
  by_day AS (
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS k, count(*)::int AS c
    FROM src GROUP BY 1 ORDER BY 1 DESC LIMIT 30
  )
  SELECT jsonb_build_object(
    'total', (SELECT total FROM totals),
    'today', (SELECT today FROM totals),
    'byGender',   (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_gender),
    'byAgeGroup', (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_age),
    'byDistrict', (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_district),
    'byDay',      (SELECT coalesce(jsonb_agg(jsonb_build_object('date', k, 'count', c) ORDER BY k), '[]'::jsonb) FROM by_day)
  );
$function$;


-- ---------- source migration: 20260717074033_042c1bc1-32f0-420b-abfe-924cf2cbff3d.sql ----------

REVOKE ALL ON FUNCTION public.registration_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.partner_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registration_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.partner_stats(uuid) TO service_role;


-- ---------- source migration: 20260717111302_67563642-32ef-499f-9760-d9e18ce897b0.sql ----------

-- ============================================================
-- Phase 1: Multi-District foundation
-- ============================================================

-- 1. districts table
CREATE TABLE IF NOT EXISTS public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.districts TO authenticated;
GRANT ALL ON public.districts TO service_role;

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "districts service manages" ON public.districts
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER districts_set_updated_at
  BEFORE UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_districts_slug ON public.districts(slug);
CREATE INDEX IF NOT EXISTS idx_districts_active ON public.districts(is_active);

-- 2. admin_district_access (Viewer Admin scoping — many-to-many)
CREATE TABLE IF NOT EXISTS public.admin_district_access (
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, district_id)
);

GRANT SELECT ON public.admin_district_access TO authenticated;
GRANT ALL ON public.admin_district_access TO service_role;

ALTER TABLE public.admin_district_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_district_access service manages" ON public.admin_district_access
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_ada_admin ON public.admin_district_access(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_ada_district ON public.admin_district_access(district_id);

-- 3. Add district_id to all data tables
ALTER TABLE public.events      ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE RESTRICT;
ALTER TABLE public.registrations       ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE RESTRICT;
ALTER TABLE public.attendance          ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE RESTRICT;
ALTER TABLE public.certificate_issues  ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.partners            ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_config_district ON public.events(district_id);
CREATE INDEX IF NOT EXISTS idx_registrations_district ON public.registrations(district_id);
CREATE INDEX IF NOT EXISTS idx_attendance_district ON public.attendance(district_id);
CREATE INDEX IF NOT EXISTS idx_certificate_issues_district ON public.certificate_issues(district_id);
CREATE INDEX IF NOT EXISTS idx_partners_district ON public.partners(district_id);

-- 4. Drop the single-active-event trigger (multiple districts can be active)
DROP TRIGGER IF EXISTS trg_single_active_event ON public.events;
-- keep function around in case of rollback; harmless without the trigger

-- 5. Seed default districts (Junagadh + Rajkot for the existing rows)
INSERT INTO public.districts (slug, name, sort_order)
VALUES ('junagadh', 'Junagadh', 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.districts (slug, name, sort_order)
VALUES ('rajkot', 'Rajkot', 2)
ON CONFLICT (slug) DO NOTHING;

-- 6. Backfill district_id on existing data
--    - The current active event (starter event) + everything attached to it -> Junagadh
--    - The existing 'rajkot'-slugged event -> Rajkot
WITH j AS (SELECT id FROM public.districts WHERE slug = 'junagadh'),
     r AS (SELECT id FROM public.districts WHERE slug = 'rajkot')
UPDATE public.events w
SET district_id = CASE
  WHEN w.slug = 'rajkot' THEN (SELECT id FROM r)
  ELSE (SELECT id FROM j)
END
WHERE w.district_id IS NULL;

-- Registrations, attendance, certs, partners inherit from their event_id.
-- Everything without a event_id defaults to Junagadh (matches historical default district).
UPDATE public.registrations reg
SET district_id = COALESCE(w.district_id, (SELECT id FROM public.districts WHERE slug = 'junagadh'))
FROM public.events w
WHERE reg.district_id IS NULL
  AND (reg.event_id = w.id OR reg.event_id IS NULL)
  AND (reg.event_id IS NOT NULL OR w.slug != 'rajkot')
;

UPDATE public.registrations
SET district_id = (SELECT id FROM public.districts WHERE slug = 'junagadh')
WHERE district_id IS NULL;

UPDATE public.attendance a
SET district_id = COALESCE(w.district_id, (SELECT id FROM public.districts WHERE slug = 'junagadh'))
FROM public.events w
WHERE a.district_id IS NULL AND a.event_id = w.id;

UPDATE public.attendance
SET district_id = (SELECT id FROM public.districts WHERE slug = 'junagadh')
WHERE district_id IS NULL;

UPDATE public.certificate_issues c
SET district_id = COALESCE(w.district_id, (SELECT id FROM public.districts WHERE slug = 'junagadh'))
FROM public.events w
WHERE c.district_id IS NULL AND c.event_id = w.id;

UPDATE public.certificate_issues
SET district_id = (SELECT id FROM public.districts WHERE slug = 'junagadh')
WHERE district_id IS NULL;

-- Existing partner(s) -> Junagadh by default (Super Admin can reassign)
UPDATE public.partners
SET district_id = (SELECT id FROM public.districts WHERE slug = 'junagadh')
WHERE district_id IS NULL;

-- 7. Optional: composite unique for partner slug scoped to district (future URL: /$district/partner/$slug)
--    Keep the existing global partners_slug_key intact for backward compat with current /register/partner/$slug route.
CREATE UNIQUE INDEX IF NOT EXISTS partners_district_slug_key
  ON public.partners(district_id, slug)
  WHERE district_id IS NOT NULL;


-- ---------- source migration: 20260717111334_67c242a3-1861-4475-b866-f30261f17841.sql ----------

CREATE POLICY "certificate_issues deny public" ON public.certificate_issues
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "certificate_issues service manages" ON public.certificate_issues
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ---------- source migration: 20260717125723_00ae6879-b7fc-49c3-a989-81274aa0dd34.sql ----------

-- ============================================================
-- 1) Registrations: BEFORE INSERT validation trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_registration_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active boolean;
  d_active boolean;
  p_status text;
  p_disabled boolean;
  cf_size int;
BEGIN
  -- Always assign registration_number from the server sequence.
  -- Client-supplied values are ignored to prevent squatting/collisions.
  NEW.registration_number := public.generate_registration_number();

  -- Certificate fields must not be pre-populated by clients.
  NEW.certificate_available := false;
  NEW.certificate_url := NULL;

  -- event_id must reference an existing active event.
  IF NEW.event_id IS NULL THEN
    RAISE EXCEPTION 'event_id is required';
  END IF;
  SELECT is_active INTO v_active FROM public.events WHERE id = NEW.event_id;
  IF v_active IS NULL THEN
    RAISE EXCEPTION 'invalid event_id';
  END IF;
  IF v_active IS NOT TRUE THEN
    RAISE EXCEPTION 'event is not active';
  END IF;

  -- district_id (if provided) must exist and be active.
  IF NEW.district_id IS NOT NULL THEN
    SELECT is_active INTO d_active FROM public.districts WHERE id = NEW.district_id;
    IF d_active IS NULL THEN
      RAISE EXCEPTION 'invalid district_id';
    END IF;
    IF d_active IS NOT TRUE THEN
      RAISE EXCEPTION 'district is not active';
    END IF;
  END IF;

  -- partner_id (if provided) must be an active, enabled partner.
  IF NEW.partner_id IS NOT NULL THEN
    SELECT status, link_disabled INTO p_status, p_disabled
      FROM public.partners WHERE id = NEW.partner_id;
    IF p_status IS NULL THEN
      RAISE EXCEPTION 'invalid partner_id';
    END IF;
    IF p_status <> 'active' OR p_disabled IS TRUE THEN
      RAISE EXCEPTION 'partner is not active';
    END IF;
  END IF;

  -- Enforce per-event mobile uniqueness.
  IF EXISTS (
    SELECT 1 FROM public.registrations
      WHERE event_id = NEW.event_id AND mobile = NEW.mobile
  ) THEN
    RAISE EXCEPTION 'mobile already registered for this event';
  END IF;

  -- Bound custom_fields size (JSON text length).
  IF NEW.custom_fields IS NOT NULL THEN
    cf_size := length(NEW.custom_fields::text);
    IF cf_size > 8000 THEN
      RAISE EXCEPTION 'custom_fields too large';
    END IF;
    IF jsonb_typeof(NEW.custom_fields) <> 'object' THEN
      RAISE EXCEPTION 'custom_fields must be an object';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_registration_insert ON public.registrations;
CREATE TRIGGER trg_validate_registration_insert
  BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.validate_registration_insert();

-- ============================================================
-- 2) storage.objects explicit fail-closed policies
-- ============================================================
DROP POLICY IF EXISTS "Deny anon storage access" ON storage.objects;
DROP POLICY IF EXISTS "Deny authenticated storage access" ON storage.objects;
DROP POLICY IF EXISTS "Service role manages storage" ON storage.objects;

CREATE POLICY "Deny anon storage access"
  ON storage.objects FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny authenticated storage access"
  ON storage.objects FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Service role manages storage"
  ON storage.objects FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ---------- source migration: 20260717125744_81035c34-19c0-47cc-a3f9-59060d5c272d.sql ----------

REVOKE ALL ON FUNCTION public.validate_registration_insert() FROM PUBLIC, anon, authenticated;


-- ---------- source migration: 20260717135230_676f130c-3359-46c8-9600-cac0b8d564ed.sql ----------

-- Extend registration_stats to accept an optional event_id filter.
-- Backward-compatible: NULL / no argument returns global aggregates as before.
CREATE OR REPLACE FUNCTION public.registration_stats(_event_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH src AS (
    SELECT * FROM public.registrations
    WHERE _event_id IS NULL OR event_id = _event_id
  ),
  totals AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
      count(*) FILTER (WHERE referred_by IS NOT NULL)::int AS total_referrals,
      count(*) FILTER (WHERE partner_id IS NOT NULL)::int AS partner_registrations
    FROM src
  ),
  by_designation AS (
    SELECT coalesce(designation, 'Other') AS k, count(*)::int AS c
    FROM src GROUP BY 1
  ),
  by_gender AS (
    SELECT coalesce(gender, 'Unspecified') AS k, count(*)::int AS c
    FROM src GROUP BY 1
  ),
  by_age AS (
    SELECT coalesce(age_group, 'Unspecified') AS k, count(*)::int AS c
    FROM src GROUP BY 1
  ),
  leaderboard AS (
    SELECT r.referred_by AS registration_number,
           coalesce(ref.full_name, '—') AS full_name,
           count(*)::int AS count
    FROM src r
    LEFT JOIN public.registrations ref
      ON ref.registration_number = r.referred_by
    WHERE r.referred_by IS NOT NULL
    GROUP BY r.referred_by, ref.full_name
    ORDER BY count DESC
    LIMIT 10
  ),
  partner_leaderboard AS (
    SELECT p.id, p.slug, p.partner_name, count(r.*)::int AS count
    FROM public.partners p
    LEFT JOIN src r ON r.partner_id = p.id
    GROUP BY p.id, p.slug, p.partner_name
    ORDER BY count DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'total', (SELECT total FROM totals),
    'today', (SELECT today FROM totals),
    'totalReferrals', (SELECT total_referrals FROM totals),
    'partnerRegistrations', (SELECT partner_registrations FROM totals),
    'byDesignation', (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_designation),
    'byGender',      (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_gender),
    'byAgeGroup',    (SELECT coalesce(jsonb_object_agg(k, c), '{}'::jsonb) FROM by_age),
    'leaderboard',   (SELECT coalesce(jsonb_agg(l), '[]'::jsonb) FROM leaderboard l),
    'partnerLeaderboard', (SELECT coalesce(jsonb_agg(p), '[]'::jsonb) FROM partner_leaderboard p)
  );
$function$;


-- ---------- source migration: 20260717135253_e316dbfe-ec23-46b9-bea1-10fe0c9b8cc2.sql ----------

REVOKE ALL ON FUNCTION public.registration_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registration_stats(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.registration_stats(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.registration_stats(uuid) TO service_role;


-- ---------- source migration: 20260717140045_4d4bdc12-04f3-4ced-81d5-f12d13f23ee3.sql ----------

-- Phase 2: Scope partners to an event and enable viewer-admin event access via districts.

-- 1. partners.event_id
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partners_event ON public.partners(event_id);

-- Backfill from district's most-recent active event (or any event in that district).
UPDATE public.partners p
   SET event_id = w.id
  FROM public.events w
 WHERE p.event_id IS NULL
   AND p.district_id IS NOT NULL
   AND w.district_id = p.district_id
   AND w.id = (
     SELECT w2.id FROM public.events w2
      WHERE w2.district_id = p.district_id
      ORDER BY w2.is_active DESC, w2.updated_at DESC
      LIMIT 1
   );

-- Partners with no district → attach to the default (legacy) active event so
-- the existing partners keep working exactly as before.
UPDATE public.partners p
   SET event_id = w.id
  FROM public.events w
 WHERE p.event_id IS NULL
   AND w.is_active = true
   AND w.id = (
     SELECT id FROM public.events WHERE is_active = true
     ORDER BY updated_at DESC LIMIT 1
   );

-- 2. Helper: event IDs a given admin user may see.
-- super_admin => all event_ids
-- view_admin  => events whose district_id is in admin_district_access
CREATE OR REPLACE FUNCTION public.admin_allowed_event_ids(_admin_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id
    FROM public.events w
   WHERE EXISTS (
     SELECT 1 FROM public.admin_users u
      WHERE u.id = _admin_user_id AND u.role = 'super_admin'
   )
  UNION
  SELECT w.id
    FROM public.events w
    JOIN public.admin_district_access a
      ON a.district_id = w.district_id
   WHERE a.admin_user_id = _admin_user_id;
$$;

REVOKE ALL ON FUNCTION public.admin_allowed_event_ids(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_allowed_event_ids(UUID) TO service_role;


-- ---------- source migration: 20260717140110_c7ca1407-26d4-4595-a25e-4b8a0fe011a7.sql ----------

REVOKE EXECUTE ON FUNCTION public.admin_allowed_event_ids(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_allowed_event_ids(UUID) TO service_role;


-- ---------- source migration: 20260717165233_124ff3da-7d77-4d54-b170-b5d3d7e5815d.sql ----------

-- Architecture refactor: promote Webinar to primary entity.
-- Additive-only. No renames, no drops, no data mutation on business tables.

-- 1) Extend events with first-class fields.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'district',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS event_time time,
  ADD COLUMN IF NOT EXISTS registration_open_at timestamptz,
  ADD COLUMN IF NOT EXISTS registration_close_at timestamptz,
  ADD COLUMN IF NOT EXISTS district_name text,
  ADD COLUMN IF NOT EXISTS youtube_live_url text;

-- Backfill district_name from districts.name where possible.
UPDATE public.events w
   SET district_name = d.name
  FROM public.districts d
 WHERE w.district_id = d.id
   AND (w.district_name IS NULL OR w.district_name = '');

-- Backfill district_name from legacy 'district' text column.
UPDATE public.events
   SET district_name = district
 WHERE district_name IS NULL AND district IS NOT NULL;

-- 2) Direct event-level admin access grants.
CREATE TABLE IF NOT EXISTS public.admin_event_access (
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, event_id)
);

GRANT SELECT ON public.admin_event_access TO authenticated;
GRANT ALL    ON public.admin_event_access TO service_role;

ALTER TABLE public.admin_event_access ENABLE ROW LEVEL SECURITY;

-- Only service_role writes/reads through app code; deny by default.
DROP POLICY IF EXISTS "admin_event_access_service_only" ON public.admin_event_access;
CREATE POLICY "admin_event_access_service_only"
  ON public.admin_event_access
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_admin_event_access_admin
  ON public.admin_event_access(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_event_access_event
  ON public.admin_event_access(event_id);

-- 3) Backfill from existing district-based access.
INSERT INTO public.admin_event_access (admin_user_id, event_id)
SELECT DISTINCT a.admin_user_id, w.id
  FROM public.admin_district_access a
  JOIN public.events w ON w.district_id = a.district_id
ON CONFLICT DO NOTHING;

-- 4) Rewrite scope helper: read from admin_event_access only.
CREATE OR REPLACE FUNCTION public.admin_allowed_event_ids(_admin_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT w.id
    FROM public.events w
   WHERE EXISTS (
     SELECT 1 FROM public.admin_users u
      WHERE u.id = _admin_user_id AND u.role = 'super_admin'
   )
  UNION
  SELECT event_id
    FROM public.admin_event_access
   WHERE admin_user_id = _admin_user_id;
$function$;


-- ---------- source migration: 20260717183835_8657eadb-e976-4abe-8065-9bdfbe12e868.sql ----------

-- Phase 0: Restore Junagadh slug
UPDATE public.events
   SET slug = 'junagadh'
 WHERE id = 'f767f409-dcc9-4071-8e39-1b36adab1724';

-- Phase 1: Remove duplicate re-registrations. For each mobile in Junagadh with
-- multiple rows, keep the earliest (the original legacy record) and delete the rest.
-- Also cascade-clean any attendance rows for the deleted duplicates.
WITH ranked AS (
  SELECT id, registration_number,
         row_number() OVER (PARTITION BY mobile ORDER BY created_at ASC) AS rn
    FROM public.registrations
   WHERE district = 'Junagadh'
),
to_delete AS (
  SELECT id, registration_number FROM ranked WHERE rn > 1
)
DELETE FROM public.attendance a
 USING to_delete d
 WHERE a.registration_number = d.registration_number;

WITH ranked AS (
  SELECT id, mobile,
         row_number() OVER (PARTITION BY mobile ORDER BY created_at ASC) AS rn
    FROM public.registrations
   WHERE district = 'Junagadh'
)
DELETE FROM public.registrations r
 USING ranked
 WHERE r.id = ranked.id AND ranked.rn > 1;

-- Phase 2: Backfill legacy default registrations
UPDATE public.registrations
   SET event_id = 'f767f409-dcc9-4071-8e39-1b36adab1724',
       district_id = COALESCE(district_id, '367d80c3-cc5d-49dd-8dad-d7e11bd21cb7')
 WHERE event_id IS NULL
   AND district = 'Junagadh';

-- Phase 3: Backfill attendance event_id from parent registration
UPDATE public.attendance a
   SET event_id = r.event_id,
       district_id = COALESCE(a.district_id, r.district_id)
  FROM public.registrations r
 WHERE a.registration_number = r.registration_number
   AND a.event_id IS NULL
   AND r.event_id IS NOT NULL;

-- Phase 4: Safety net for any other stragglers
UPDATE public.registrations
   SET event_id = 'f767f409-dcc9-4071-8e39-1b36adab1724',
       district_id = COALESCE(district_id, '367d80c3-cc5d-49dd-8dad-d7e11bd21cb7')
 WHERE event_id IS NULL;

-- Phase 5: Enforce NOT NULL going forward
ALTER TABLE public.registrations       ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.attendance          ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.certificate_issues  ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.partners            ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.event_notices     ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.event_broadcasts  ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE public.certificate_templates ALTER COLUMN event_id SET NOT NULL;

-- Phase 6: Defensive trigger — auto-fill attendance event_id from registration
CREATE OR REPLACE FUNCTION public.attendance_fill_event_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_event uuid;
  r_district uuid;
BEGIN
  IF NEW.event_id IS NULL OR NEW.district_id IS NULL THEN
    SELECT event_id, district_id INTO r_event, r_district
      FROM public.registrations
     WHERE registration_number = NEW.registration_number
     LIMIT 1;
    IF NEW.event_id IS NULL THEN NEW.event_id := r_event; END IF;
    IF NEW.district_id IS NULL THEN NEW.district_id := r_district; END IF;
  END IF;
  IF NEW.event_id IS NULL THEN
    RAISE EXCEPTION 'attendance.event_id is required and could not be resolved';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_fill_event_id ON public.attendance;
CREATE TRIGGER trg_attendance_fill_event_id
BEFORE INSERT ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.attendance_fill_event_id();


-- ---------- source migration: 20260717183914_aa4d0cff-8646-4377-bc94-cd338362c75f.sql ----------

REVOKE EXECUTE ON FUNCTION public.attendance_fill_event_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_fill_event_id() TO service_role;


-- ---------- source migration: 20260717190918_121a25c3-d898-4201-90e1-635a386216f5.sql ----------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_category text;

CREATE INDEX IF NOT EXISTS events_is_template_idx
  ON public.events (is_template) WHERE is_template = true;

CREATE TABLE IF NOT EXISTS public.event_organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.event_organisations TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS event_organisations_unique_name
  ON public.event_organisations (event_id, lower(name));
CREATE INDEX IF NOT EXISTS event_organisations_event_idx
  ON public.event_organisations (event_id);

ALTER TABLE public.event_organisations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_organisations_deny_all" ON public.event_organisations;
CREATE POLICY "event_organisations_deny_all"
  ON public.event_organisations
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP TRIGGER IF EXISTS event_organisations_set_updated_at ON public.event_organisations;
CREATE TRIGGER event_organisations_set_updated_at
  BEFORE UPDATE ON public.event_organisations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.event_overview()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH w AS (
    SELECT id, slug, is_active, is_template, lifecycle_status,
           district, district_name, general, event_date, event_time,
           registration_open_at, registration_close_at, created_at
      FROM public.events
     WHERE coalesce(is_template, false) = false
  ),
  reg AS (
    SELECT event_id,
           count(*)::int AS total,
           count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
           count(*) FILTER (WHERE certificate_available = true)::int AS certs_issued
      FROM public.registrations
     GROUP BY event_id
  ),
  att AS (
    SELECT event_id, count(DISTINCT registration_number)::int AS joined
      FROM public.attendance
     GROUP BY event_id
  ),
  prt AS (
    SELECT event_id, count(*)::int AS partners
      FROM public.partners
     GROUP BY event_id
  ),
  org AS (
    SELECT event_id, count(*)::int AS organisations
      FROM public.event_organisations
     WHERE status = 'active'
     GROUP BY event_id
  )
  SELECT coalesce(jsonb_agg(row ORDER BY row->>'created_at' DESC), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'id', w.id,
        'slug', w.slug,
        'is_active', w.is_active,
        'lifecycle_status', w.lifecycle_status,
        'title', coalesce(w.general->>'title', w.slug),
        'district', coalesce(w.district_name, w.district),
        'event_date', w.event_date,
        'event_time', w.event_time,
        'registration_open_at', w.registration_open_at,
        'registration_close_at', w.registration_close_at,
        'created_at', w.created_at,
        'registrations', coalesce(reg.total, 0),
        'today', coalesce(reg.today, 0),
        'joined_live', coalesce(att.joined, 0),
        'certificates_issued', coalesce(reg.certs_issued, 0),
        'partners', coalesce(prt.partners, 0),
        'organisations', coalesce(org.organisations, 0)
      ) AS row
        FROM w
        LEFT JOIN reg ON reg.event_id = w.id
        LEFT JOIN att ON att.event_id = w.id
        LEFT JOIN prt ON prt.event_id = w.id
        LEFT JOIN org ON org.event_id = w.id
    ) s;
$$;

GRANT EXECUTE ON FUNCTION public.event_overview() TO service_role;
REVOKE ALL ON FUNCTION public.event_overview() FROM anon, authenticated;


-- ---------- source migration: 20260717194716_92b64d57-187c-49da-91b3-73d6ebc50860.sql ----------

-- 1. Column
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS publish_status text NOT NULL DEFAULT 'draft'
    CHECK (publish_status IN ('draft','published','archived'));

-- 2. Backfill from is_active / is_template
UPDATE public.events
   SET publish_status = CASE
     WHEN is_template = true THEN 'draft'
     WHEN is_active = true THEN 'published'
     ELSE 'archived'
   END
 WHERE publish_status = 'draft';

-- 3. Index for public listing
CREATE INDEX IF NOT EXISTS events_publish_status_idx
  ON public.events (publish_status)
  WHERE is_template = false;

-- 4. Rewrite overview to include publish_status and only surface non-templates
CREATE OR REPLACE FUNCTION public.event_overview()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH w AS (
    SELECT id, slug, is_active, is_template, lifecycle_status, publish_status,
           district, district_name, general, event_date, event_time,
           registration_open_at, registration_close_at, created_at
      FROM public.events
     WHERE coalesce(is_template, false) = false
  ),
  reg AS (
    SELECT event_id,
           count(*)::int AS total,
           count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today,
           count(*) FILTER (WHERE certificate_available = true)::int AS certs_issued
      FROM public.registrations
     GROUP BY event_id
  ),
  att AS (
    SELECT event_id, count(DISTINCT registration_number)::int AS joined
      FROM public.attendance
     GROUP BY event_id
  ),
  prt AS (
    SELECT event_id, count(*)::int AS partners
      FROM public.partners
     GROUP BY event_id
  ),
  org AS (
    SELECT event_id, count(*)::int AS organisations
      FROM public.event_organisations
     WHERE status = 'active'
     GROUP BY event_id
  )
  SELECT coalesce(jsonb_agg(row ORDER BY row->>'created_at' DESC), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
        'id', w.id,
        'slug', w.slug,
        'is_active', w.is_active,
        'lifecycle_status', w.lifecycle_status,
        'publish_status', w.publish_status,
        'title', coalesce(w.general->>'title', w.slug),
        'district', coalesce(w.district_name, w.district),
        'event_date', w.event_date,
        'event_time', w.event_time,
        'registration_open_at', w.registration_open_at,
        'registration_close_at', w.registration_close_at,
        'created_at', w.created_at,
        'registrations', coalesce(reg.total, 0),
        'today', coalesce(reg.today, 0),
        'joined_live', coalesce(att.joined, 0),
        'certificates_issued', coalesce(reg.certs_issued, 0),
        'partners', coalesce(prt.partners, 0),
        'organisations', coalesce(org.organisations, 0)
      ) AS row
        FROM w
        LEFT JOIN reg ON reg.event_id = w.id
        LEFT JOIN att ON att.event_id = w.id
        LEFT JOIN prt ON prt.event_id = w.id
        LEFT JOIN org ON org.event_id = w.id
    ) s;
$function$;


-- ---------- source migration: 20260717194741_5a82cd77-8006-4f43-b44e-fd03fca90a5d.sql ----------

REVOKE EXECUTE ON FUNCTION public.event_overview() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registration_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registration_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.partner_stats(uuid) FROM PUBLIC, anon, authenticated;


-- ---------- source migration: 20260718054619_96186808-8f47-4da4-a443-5ad36918bf7c.sql ----------

-- Multi-organisation support on partners + partner-form field config on events.
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS organizations text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill array from legacy single-value column so existing rows keep displaying.
UPDATE public.partners
   SET organizations = ARRAY[organization]
 WHERE (organizations IS NULL OR cardinality(organizations) = 0)
   AND organization IS NOT NULL
   AND btrim(organization) <> '';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS partner_form jsonb NOT NULL DEFAULT '{}'::jsonb;


-- ---------- source migration: 20260718070100_a52532fa-7f0c-461b-8081-851e17dddad3.sql ----------
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------- source migration: 20260718081553_6e46ff23-bd5e-495e-93ba-a2ddcdb86be1.sql ----------

-- Per-event participant ID prefix + sequence (event isolation)

-- 1) Prefix column on events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS reg_prefix text;

-- Backfill known districts, then any other row from slug
UPDATE public.events SET reg_prefix = 'SSA' WHERE slug = 'junagadh' AND reg_prefix IS NULL;
UPDATE public.events SET reg_prefix = 'SSARJT' WHERE slug = 'rajkot'   AND reg_prefix IS NULL;
UPDATE public.events SET reg_prefix = 'SSAVLD' WHERE slug = 'valsad'   AND reg_prefix IS NULL;
UPDATE public.events
   SET reg_prefix = 'SSA' || upper(regexp_replace(coalesce(slug, 'WBN'), '[^a-zA-Z]', '', 'g'))
 WHERE reg_prefix IS NULL;

-- Ensure short 3-letter suffix (clip to 3 after SSA)
UPDATE public.events
   SET reg_prefix = 'SSA' || upper(substr(regexp_replace(reg_prefix, '^SSA', ''), 1, 3))
 WHERE reg_prefix !~ '^SSA[A-Z]{2,}$';

-- Uniqueness of prefix across published events (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS events_reg_prefix_uk
  ON public.events (lower(reg_prefix)) WHERE reg_prefix IS NOT NULL;

-- 2) Per-event sequence table
CREATE TABLE IF NOT EXISTS public.event_reg_seq (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  next_val bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.event_reg_seq TO service_role;
ALTER TABLE public.event_reg_seq ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seq no direct access" ON public.event_reg_seq;
CREATE POLICY "seq no direct access" ON public.event_reg_seq FOR ALL USING (false) WITH CHECK (false);

-- Seed sequences. For Junagadh we continue from current max so existing
-- SSA links stay valid; for other events we start each prefix fresh at 1
-- so their referral sequence is fully independent.
INSERT INTO public.event_reg_seq (event_id, next_val)
SELECT w.id,
       CASE
         WHEN w.slug = 'junagadh' THEN
           coalesce((SELECT max(substring(registration_number from '\d+$')::bigint)
                       FROM public.registrations
                      WHERE event_id = w.id
                        AND registration_number ~ ('^' || w.reg_prefix || '\d+$')), 0) + 1
         ELSE 1
       END
  FROM public.events w
 WHERE coalesce(w.is_template, false) = false
ON CONFLICT (event_id) DO NOTHING;

-- 3) New generator: prefix + zero-padded per-event sequence
CREATE OR REPLACE FUNCTION public.generate_registration_number(_event_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next   bigint;
BEGIN
  IF _event_id IS NULL THEN
    RAISE EXCEPTION 'event_id is required to generate registration number';
  END IF;

  SELECT reg_prefix INTO v_prefix
    FROM public.events WHERE id = _event_id;
  IF v_prefix IS NULL OR v_prefix = '' THEN
    RAISE EXCEPTION 'event % has no reg_prefix configured', _event_id;
  END IF;

  INSERT INTO public.event_reg_seq (event_id, next_val)
       VALUES (_event_id, 1)
  ON CONFLICT (event_id) DO NOTHING;

  UPDATE public.event_reg_seq
     SET next_val = next_val + 1,
         updated_at = now()
   WHERE event_id = _event_id
   RETURNING next_val - 1 INTO v_next;

  RETURN v_prefix || lpad(v_next::text, 6, '0');
END;
$$;

-- Keep the old no-arg function for backward compatibility, but route it to
-- the default event so nothing that still calls it explodes.
CREATE OR REPLACE FUNCTION public.generate_registration_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.events
   WHERE slug = 'junagadh' AND coalesce(is_template,false)=false
   ORDER BY updated_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.events
     WHERE coalesce(is_template,false)=false AND is_active
     ORDER BY updated_at DESC LIMIT 1;
  END IF;
  RETURN public.generate_registration_number(v_id);
END;
$$;

-- 4) Update the insert-validation trigger to use the per-event generator
CREATE OR REPLACE FUNCTION public.validate_registration_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active boolean;
  d_active boolean;
  p_status text;
  p_disabled boolean;
  cf_size int;
BEGIN
  -- Certificate fields must not be pre-populated by clients.
  NEW.certificate_available := false;
  NEW.certificate_url := NULL;

  -- event_id must reference an existing active event.
  IF NEW.event_id IS NULL THEN
    RAISE EXCEPTION 'event_id is required';
  END IF;
  SELECT is_active INTO v_active FROM public.events WHERE id = NEW.event_id;
  IF v_active IS NULL THEN
    RAISE EXCEPTION 'invalid event_id';
  END IF;
  IF v_active IS NOT TRUE THEN
    RAISE EXCEPTION 'event is not active';
  END IF;

  -- Assign registration_number from the per-event generator.
  NEW.registration_number := public.generate_registration_number(NEW.event_id);
  NEW.referral_code := NEW.registration_number;

  IF NEW.district_id IS NOT NULL THEN
    SELECT is_active INTO d_active FROM public.districts WHERE id = NEW.district_id;
    IF d_active IS NULL THEN RAISE EXCEPTION 'invalid district_id'; END IF;
    IF d_active IS NOT TRUE THEN RAISE EXCEPTION 'district is not active'; END IF;
  END IF;

  IF NEW.partner_id IS NOT NULL THEN
    SELECT status, link_disabled INTO p_status, p_disabled
      FROM public.partners WHERE id = NEW.partner_id;
    IF p_status IS NULL THEN RAISE EXCEPTION 'invalid partner_id'; END IF;
    IF p_status <> 'active' OR p_disabled IS TRUE THEN
      RAISE EXCEPTION 'partner is not active';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.registrations
      WHERE event_id = NEW.event_id AND mobile = NEW.mobile
  ) THEN
    RAISE EXCEPTION 'mobile already registered for this event';
  END IF;

  IF NEW.custom_fields IS NOT NULL THEN
    cf_size := length(NEW.custom_fields::text);
    IF cf_size > 8000 THEN RAISE EXCEPTION 'custom_fields too large'; END IF;
    IF jsonb_typeof(NEW.custom_fields) <> 'object' THEN
      RAISE EXCEPTION 'custom_fields must be an object';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ---------- source migration: 20260718081616_1a8c66f2-6487-4519-a722-67b5b76e3572.sql ----------

REVOKE ALL ON FUNCTION public.generate_registration_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_registration_number()      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_registration_number(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_registration_number()      TO service_role;


-- ---------- source migration: 20260718081721_e49f413d-dde2-4e77-a057-d19b92cb3d7c.sql ----------

CREATE OR REPLACE FUNCTION public.event_assign_prefix()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_candidate text;
  v_n int := 0;
BEGIN
  IF NEW.reg_prefix IS NULL OR NEW.reg_prefix = '' THEN
    v_base := upper(substr(regexp_replace(coalesce(NEW.slug, 'WBN'), '[^a-zA-Z]', '', 'g'), 1, 3));
    IF v_base = '' THEN v_base := 'WBN'; END IF;
    v_candidate := 'SSA' || v_base;
    WHILE EXISTS (
      SELECT 1 FROM public.events
       WHERE lower(reg_prefix) = lower(v_candidate) AND id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) LOOP
      v_n := v_n + 1;
      v_candidate := 'SSA' || v_base || v_n::text;
    END LOOP;
    NEW.reg_prefix := v_candidate;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.event_assign_prefix() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_event_assign_prefix ON public.events;
CREATE TRIGGER trg_event_assign_prefix
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.event_assign_prefix();


-- ---------- source migration: 20260720100240_941a5c01-0fe4-4618-bd46-66aa9c0c2d3a.sql ----------

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS qr_token text;
CREATE UNIQUE INDEX IF NOT EXISTS events_qr_token_key ON public.events (qr_token) WHERE qr_token IS NOT NULL;


-- ---------- source migration: 20260720104741_34b35848-00a0-40f4-9008-a849ef56ea6d.sql ----------
UPDATE public.events
SET features = coalesce(features, '{}'::jsonb) || jsonb_build_object('live', true)
WHERE qr_token IS NOT NULL
  AND coalesce((features->>'live')::boolean, false) = false;

-- ---------- source migration: 20260721060447_8301b440-d971-4eeb-a264-3c74b28573c4.sql ----------

-- Perf: cover the two hottest lookups on events (public slug lookup and admin list).
CREATE INDEX IF NOT EXISTS idx_events_config_slug_public
  ON public.events (slug)
  WHERE is_template = false AND publish_status = 'published';

CREATE INDEX IF NOT EXISTS idx_events_updated_at
  ON public.events (updated_at DESC)
  WHERE is_template = false;

-- Perf: covers admin registration list (event_id + created_at desc).
CREATE INDEX IF NOT EXISTS idx_registrations_event_created
  ON public.registrations (event_id, created_at DESC);

ANALYZE public.events;
ANALYZE public.registrations;


-- ---------- source migration: 20260803075411_9ef74bb7-c0fe-4f1a-8a90-7c45653e8d35.sql ----------
-- Remove the implicit "default event" fallback from the
-- participant-ID generator. Every caller must name an event explicitly.
CREATE OR REPLACE FUNCTION public.generate_registration_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'generate_registration_number() requires an explicit event_id; the default-event fallback has been removed';
END;
$function$;

-- Two events must never share a participant-ID sequence prefix.
CREATE UNIQUE INDEX IF NOT EXISTS events_reg_prefix_unique
  ON public.events (lower(reg_prefix))
  WHERE reg_prefix IS NOT NULL;

-- ---------- source migration: 20260810073443_fd5575a4-9096-41e6-9efd-405e9c1b3ea6.sql ----------
CREATE OR REPLACE FUNCTION public.registration_geo_counts(_event_id uuid)
RETURNS TABLE(field text, value text, cnt bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'taluka'::text, coalesce(nullif(btrim(taluka), ''), 'Unspecified'), count(*)::bigint
    FROM public.registrations
   WHERE event_id = _event_id
   GROUP BY 2
  UNION ALL
  SELECT 'district'::text, coalesce(nullif(btrim(district), ''), 'Unspecified'), count(*)::bigint
    FROM public.registrations
   WHERE event_id = _event_id
   GROUP BY 2;
$$;

REVOKE ALL ON FUNCTION public.registration_geo_counts(uuid) FROM PUBLIC, anon, authenticated;

-- ---------- source migration: 20260814115038_4160133b-cbf8-4d6c-82de-b10936c209b0.sql ----------
-- ============================================================
-- Complete Gujarat district master data (ADDITIVE ONLY)
-- ============================================================
-- The production `districts` table currently contains only the two
-- originally-seeded rows (Junagadh, sort_order 1; Rajkot, sort_order 2).
-- This migration adds the remaining 32 active Gujarat districts so the
-- master table holds all 34.
--
-- SAFETY:
--   * INSERT ... ON CONFLICT (slug) DO NOTHING  -> idempotent; re-running is
--     a no-op. Existing Junagadh / Rajkot rows are never updated, renamed,
--     or deleted (their sort_order 1 / 2 are left as-is, so they stay first
--     in admin dropdowns).
--   * No ALTER TABLE, no DROP, no UPDATE. No application code changes here.
--   * The `districts` table remains the single source of truth for district
--     selection everywhere (wizard, coverage tab, State Select All, form
--     options, registration validation, admin breakdowns).

INSERT INTO public.districts (slug, name, is_active, sort_order) VALUES
  ('ahmedabad',        'Ahmedabad',        true, 3),
  ('amreli',           'Amreli',           true, 4),
  ('anand',            'Anand',            true, 5),
  ('aravalli',         'Aravalli',         true, 6),
  ('banaskantha',      'Banaskantha',      true, 7),
  ('bharuch',          'Bharuch',          true, 8),
  ('bhavnagar',        'Bhavnagar',        true, 9),
  ('botad',            'Botad',            true, 10),
  ('chhota-udepur',    'Chhota Udepur',    true, 11),
  ('dahod',            'Dahod',            true, 12),
  ('dang',             'Dang',             true, 13),
  ('devbhumi-dwarka',  'Devbhumi Dwarka',  true, 14),
  ('gandhinagar',      'Gandhinagar',      true, 15),
  ('gir-somnath',      'Gir Somnath',      true, 16),
  ('jamnagar',         'Jamnagar',         true, 17),
  ('kheda',            'Kheda',            true, 18),
  ('kutch',            'Kutch',            true, 19),
  ('mahisagar',        'Mahisagar',        true, 20),
  ('mehsana',          'Mehsana',          true, 21),
  ('morbi',            'Morbi',            true, 22),
  ('narmada',          'Narmada',          true, 23),
  ('navsari',          'Navsari',          true, 24),
  ('panchmahal',       'Panchmahal',       true, 25),
  ('patan',            'Patan',            true, 26),
  ('porbandar',        'Porbandar',        true, 27),
  ('sabarkantha',      'Sabarkantha',      true, 28),
  ('surat',            'Surat',            true, 29),
  ('surendranagar',    'Surendranagar',    true, 30),
  ('tapi',             'Tapi',             true, 31),
  ('vadodara',         'Vadodara',         true, 32),
  ('valsad',           'Valsad',           true, 33),
  ('vav-tharad',       'Vav-Tharad',       true, 34)
ON CONFLICT (slug) DO NOTHING;

-- Verification (expect 34 rows; junagadh + rajkot still present and unchanged):
--   SELECT sort_order, slug, name, is_active FROM public.districts ORDER BY sort_order;
--   SELECT count(*) FROM public.districts WHERE is_active = true;

-- ---------- source migration: 20260814120000_add_gujarat_district_master.sql ----------
-- ============================================================
-- Complete Gujarat district master data (ADDITIVE ONLY)
-- ============================================================
-- The production `districts` table currently contains only the two
-- originally-seeded rows (Junagadh, sort_order 1; Rajkot, sort_order 2).
-- This migration adds the remaining 32 active Gujarat districts so the
-- master table holds all 34.
--
-- SAFETY:
--   * INSERT ... ON CONFLICT (slug) DO NOTHING  -> idempotent; re-running is
--     a no-op. Existing Junagadh / Rajkot rows are never updated, renamed,
--     or deleted (their sort_order 1 / 2 are left as-is, so they stay first
--     in admin dropdowns).
--   * No ALTER TABLE, no DROP, no UPDATE. No application code changes here.
--   * The `districts` table remains the single source of truth for district
--     selection everywhere (wizard, coverage tab, State Select All, form
--     options, registration validation, admin breakdowns).

INSERT INTO public.districts (slug, name, is_active, sort_order) VALUES
  ('ahmedabad',        'Ahmedabad',        true, 3),
  ('amreli',           'Amreli',           true, 4),
  ('anand',            'Anand',            true, 5),
  ('aravalli',         'Aravalli',         true, 6),
  ('banaskantha',      'Banaskantha',      true, 7),
  ('bharuch',          'Bharuch',          true, 8),
  ('bhavnagar',        'Bhavnagar',        true, 9),
  ('botad',            'Botad',            true, 10),
  ('chhota-udepur',    'Chhota Udepur',    true, 11),
  ('dahod',            'Dahod',            true, 12),
  ('dang',             'Dang',             true, 13),
  ('devbhumi-dwarka',  'Devbhumi Dwarka',  true, 14),
  ('gandhinagar',      'Gandhinagar',      true, 15),
  ('gir-somnath',      'Gir Somnath',      true, 16),
  ('jamnagar',         'Jamnagar',         true, 17),
  ('kheda',            'Kheda',            true, 18),
  ('kutch',            'Kutch',            true, 19),
  ('mahisagar',        'Mahisagar',        true, 20),
  ('mehsana',          'Mehsana',          true, 21),
  ('morbi',            'Morbi',            true, 22),
  ('narmada',          'Narmada',          true, 23),
  ('navsari',          'Navsari',          true, 24),
  ('panchmahal',       'Panchmahal',       true, 25),
  ('patan',            'Patan',            true, 26),
  ('porbandar',        'Porbandar',        true, 27),
  ('sabarkantha',      'Sabarkantha',      true, 28),
  ('surat',            'Surat',            true, 29),
  ('surendranagar',    'Surendranagar',    true, 30),
  ('tapi',             'Tapi',             true, 31),
  ('vadodara',         'Vadodara',         true, 32),
  ('valsad',           'Valsad',           true, 33),
  ('vav-tharad',       'Vav-Tharad',       true, 34)
ON CONFLICT (slug) DO NOTHING;

-- Verification (expect 34 rows; junagadh + rajkot still present and unchanged):
--   SELECT sort_order, slug, name, is_active FROM public.districts ORDER BY sort_order;
--   SELECT count(*) FROM public.districts WHERE is_active = true;



-- ---------- fresh-install adjustment: default microsite slug ----------
-- The app resolves legacy top-level routes (/register, /certificate, /success)
-- against the canonical "default" microsite slug (see src/lib/brand.ts).
-- Give the seeded starter event that slug so those routes work immediately.
UPDATE public.events
SET slug = 'default'
WHERE general->>'title' = 'Online Yoga Webinar'
  AND slug LIKE 'event-%'
  AND NOT EXISTS (SELECT 1 FROM public.events WHERE slug = 'default');

-- ============================================================
-- SSA — YOG ANE DHYAN SHIBIR: physical event portal adjustments
-- ============================================================

-- Events: venue field for the physical camp location
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue text;

-- Participants: email + organization/centre + personal QR token
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS organization text,
  ADD COLUMN IF NOT EXISTS qr_token text;

-- Unique QR identifier per participant (unique globally; token is random).
CREATE UNIQUE INDEX IF NOT EXISTS registrations_qr_token_key
  ON public.registrations (qr_token) WHERE qr_token IS NOT NULL;

-- Backfill qr_token for rows that pre-date this change (fresh installs get
-- tokens at registration time from the app).
UPDATE public.registrations
SET qr_token = encode(gen_random_bytes(12), 'hex')
WHERE qr_token IS NULL;

-- Renamed event_notices kind check (physical event model)
ALTER TABLE public.event_notices DROP CONSTRAINT IF EXISTS event_notices_kind_check;
ALTER TABLE public.event_notices ADD CONSTRAINT event_notices_kind_check
  CHECK (kind IN ('top_banner','popup','emergency','registration_closing','certificate_available'));

-- Seeded starter event: retitle to the shibir program and set a venue.
UPDATE public.events
SET general = jsonb_set(
      jsonb_set(
        general,
        '{title}',
        '"Yog ane Dhyan Shibir"'::jsonb
      ),
      '{subtitle}',
      '"Seva Sushasan Abhiyan"'::jsonb
    ),
    venue = COALESCE(venue, 'Shibir Venue')
WHERE slug = 'default'
  AND general->>'title' = 'Online Yoga Webinar';

-- Fix the seed-event slug adjustment predicate to match the retitled row
-- (the update above runs first, so re-run the slug assignment defensively).
UPDATE public.events
SET slug = 'default'
WHERE general->>'title' = 'Yog ane Dhyan Shibir'
  AND slug LIKE 'event-%'
  AND NOT EXISTS (SELECT 1 FROM public.events WHERE slug = 'default');

-- ============================================================
-- CAMPAIGN LAYER — Gujarat State Yog Board platform
-- Organization (GSYB) → Campaigns → Events → Registrations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  slogan text,
  description text,
  start_date date,
  end_date date,
  venue text,
  organizer text,
  contact_info text,
  logo_url text,
  banner_url text,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  publish_status text NOT NULL DEFAULT 'draft'
    CHECK (publish_status IN ('draft','published','archived')),
  registration_status text NOT NULL DEFAULT 'closed'
    CHECK (registration_status IN ('open','closed')),
  seo_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS events_campaign_id_idx ON public.events (campaign_id);

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS registrations_campaign_id_idx ON public.registrations (campaign_id);

ALTER TABLE public.certificate_issues
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- Seed the initial campaign: Seva Sushasan Abhiyan
INSERT INTO public.campaigns (slug, name, slogan, description, organizer, publish_status, registration_status, theme)
VALUES (
  'seva-sushasan-abhiyan',
  'Seva Sushasan Abhiyan',
  'Transform Your Life Through Yoga',
  'A campaign of the Gujarat State Yog Board conducting Yog ane Dhyan Shibir events across Gujarat.',
  'Gujarat State Yog Board',
  'published',
  'open',
  '{"primaryColor":"#9F3138","secondaryColor":"#C04A44","accentColor":"#F2A81D","backgroundColor":"#FFF7F2","textColor":"#2B1B1B","buttonColor":"#9F3138"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Attach the seeded default event to the initial campaign.
UPDATE public.events
SET campaign_id = (SELECT id FROM public.campaigns WHERE slug = 'seva-sushasan-abhiyan')
WHERE slug = 'default'
  AND campaign_id IS NULL;

-- Attach existing registrations of that event to the campaign as well.
UPDATE public.registrations r
SET campaign_id = e.campaign_id
FROM public.events e
WHERE r.event_id = e.id
  AND e.slug = 'default'
  AND r.campaign_id IS NULL;

-- RLS: campaigns are managed by service-role only; public reads go through
-- server functions. No direct client access policies are required, but the
-- table must have RLS enabled to match the project convention.
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CAMPAIGN MEDIA — public storage bucket for campaign uploads
-- (logos / banners / hero images). Admin-only writes happen through
-- server functions using the service role; the bucket is public-read
-- so uploaded images can render on public campaign pages.
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-media', 'campaign-media', true)
ON CONFLICT (id) DO NOTHING;
