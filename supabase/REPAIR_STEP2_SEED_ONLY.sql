-- ============================================================================
-- REPAIR_STEP2_SEED_ONLY.sql — NON-DESTRUCTIVE SEED-ONLY SCRIPT
-- Target project: ixrrfpklxxqqkdnwwlaa (Yog Board)
--
-- PURPOSE
--   Insert ONLY the missing initial seed rows so that:
--     (a) superadmin bootstrap login works (admin_users row with no password
--         hash -> accepts ADMIN_PASSWORD once, then forces a real password),
--     (b) the published "default" registration event exists for /default and
--         /default/register,
--     (c) districts / campaigns / app_settings / event_reg_seq are complete.
--
-- SAFETY GUARANTEES
--   * NO DROP, NO DELETE, NO TRUNCATE, NO ALTER TABLE, no table recreation.
--   * Registrations, attendance and certificate data are NOT touched.
--   * Every INSERT is guarded (ON CONFLICT DO NOTHING / WHERE NOT EXISTS):
--     existing rows are never modified or duplicated.
--   * Each statement is wrapped in an exception-safe DO block: if a table is
--     absent or a column is missing, the script SKIPS it, prints a NOTICE and
--     still commits everything else (no half-rolled-back transaction).
--   * Re-running this script is always a no-op on already-seeded data.
--
-- USAGE
--   Supabase dashboard -> project ixrrfpklxxqqkdnwwlaa -> SQL Editor ->
--   paste this file -> Run. Read the NOTICE output, then the verification
--   counts at the end.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. app_settings (public-readable flags)
-- ---------------------------------------------------------------------------
DO $seed$
BEGIN
  INSERT INTO public.app_settings (key, value)
  VALUES ('certificates_enabled', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;
EXCEPTION
  WHEN undefined_table THEN RAISE NOTICE 'SKIP app_settings: table missing';
  WHEN undefined_column THEN RAISE NOTICE 'SKIP app_settings: column mismatch (%).', SQLERRM;
END
$seed$;

-- ---------------------------------------------------------------------------
-- 2. site_settings (singleton site identity)
-- ---------------------------------------------------------------------------
DO $seed$
BEGIN
  INSERT INTO public.site_settings (singleton, name)
  VALUES (true, 'State Yog Board')
  ON CONFLICT (singleton) DO NOTHING;
EXCEPTION
  WHEN undefined_table THEN RAISE NOTICE 'SKIP site_settings: table missing';
  WHEN undefined_column THEN RAISE NOTICE 'SKIP site_settings: column mismatch (%).', SQLERRM;
END
$seed$;

-- ---------------------------------------------------------------------------
-- 3. admin_users — superadmin (bootstrap) + vieweradmin (disabled by default)
--    NOTE: password_hash is left NULL on purpose. The login handler treats a
--    hash-less superadmin row as "bootstrap": ADMIN_PASSWORD is accepted once.
-- ---------------------------------------------------------------------------
DO $seed$
BEGIN
  INSERT INTO public.admin_users (username, role, disabled, must_change_password)
  VALUES ('superadmin', 'super_admin', false, true)
  ON CONFLICT (username) DO NOTHING;

  INSERT INTO public.admin_users (username, role, disabled, must_change_password)
  VALUES ('vieweradmin', 'view_admin', true, true)
  ON CONFLICT (username) DO NOTHING;
EXCEPTION
  WHEN undefined_table THEN RAISE NOTICE 'SKIP admin_users: table missing';
  WHEN undefined_object THEN RAISE NOTICE 'SKIP admin_users: admin_role enum missing (%).', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'SKIP admin_users: column mismatch (%).', SQLERRM;
END
$seed$;

-- ---------------------------------------------------------------------------
-- 4. districts — all 34 Gujarat districts (idempotent; existing rows kept)
-- ---------------------------------------------------------------------------
DO $seed$
BEGIN
  INSERT INTO public.districts (slug, name, is_active, sort_order) VALUES
    ('junagadh',        'Junagadh',        true,  1),
    ('rajkot',          'Rajkot',          true,  2),
    ('ahmedabad',       'Ahmedabad',       true,  3),
    ('amreli',          'Amreli',          true,  4),
    ('anand',           'Anand',           true,  5),
    ('aravalli',        'Aravalli',        true,  6),
    ('banaskantha',     'Banaskantha',     true,  7),
    ('bharuch',         'Bharuch',         true,  8),
    ('bhavnagar',       'Bhavnagar',       true,  9),
    ('botad',           'Botad',           true, 10),
    ('chhota-udepur',   'Chhota Udepur',   true, 11),
    ('dahod',           'Dahod',           true, 12),
    ('dang',            'Dang',            true, 13),
    ('devbhumi-dwarka', 'Devbhumi Dwarka', true, 14),
    ('gandhinagar',     'Gandhinagar',     true, 15),
    ('gir-somnath',     'Gir Somnath',     true, 16),
    ('jamnagar',        'Jamnagar',        true, 17),
    ('kheda',           'Kheda',           true, 18),
    ('kutch',           'Kutch',           true, 19),
    ('mahisagar',       'Mahisagar',       true, 20),
    ('mehsana',         'Mehsana',         true, 21),
    ('morbi',           'Morbi',           true, 22),
    ('narmada',         'Narmada',         true, 23),
    ('navsari',         'Navsari',         true, 24),
    ('panchmahal',      'Panchmahal',      true, 25),
    ('patan',           'Patan',           true, 26),
    ('porbandar',       'Porbandar',       true, 27),
    ('sabarkantha',     'Sabarkantha',     true, 28),
    ('surat',           'Surat',           true, 29),
    ('surendranagar',   'Surendranagar',   true, 30),
    ('tapi',            'Tapi',            true, 31),
    ('vadodara',        'Vadodara',        true, 32),
    ('valsad',          'Valsad',          true, 33),
    ('vav-tharad',      'Vav-Tharad',      true, 34)
  ON CONFLICT (slug) DO NOTHING;
EXCEPTION
  WHEN undefined_table THEN RAISE NOTICE 'SKIP districts: table missing';
  WHEN undefined_column THEN RAISE NOTICE 'SKIP districts: column mismatch (%).', SQLERRM;
END
$seed$;

-- ---------------------------------------------------------------------------
-- 5. campaigns — "Seva Sushasan Abhiyan" (published, registration open)
-- ---------------------------------------------------------------------------
DO $seed$
BEGIN
  INSERT INTO public.campaigns
    (slug, name, slogan, description, organizer, publish_status, registration_status, theme)
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
EXCEPTION
  WHEN undefined_table THEN RAISE NOTICE 'SKIP campaigns: table missing (campaign layer not applied to this project)';
  WHEN check_violation THEN RAISE NOTICE 'SKIP campaigns: status check violation (%).', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'SKIP campaigns: column mismatch (%).', SQLERRM;
END
$seed$;

-- ---------------------------------------------------------------------------
-- 6. events — the published "default" microsite (Yog ane Dhyan Shibir)
--    * reg_prefix 'SSADEF' is exactly what the app's BEFORE INSERT trigger
--      would derive from slug 'default'; setting it explicitly also works if
--      that trigger is absent.
--    * WHERE NOT EXISTS guard: never touches an existing 'default' event.
-- ---------------------------------------------------------------------------
DO $seed$
BEGIN
  INSERT INTO public.events
    (slug, reg_prefix, is_active, is_template, publish_status, venue,
     general, features, live, attendance, certificate, referral, whatsapp, social)
  SELECT
    'default', 'SSADEF', true, false, 'published', 'Shibir Venue',
    '{"title":"Yog ane Dhyan Shibir","subtitle":"Seva Sushasan Abhiyan","theme":"Transform Your Life Through Yoga","description":"Join the Yog ane Dhyan Shibir organized by Seva Sushasan Abhiyan and begin your journey towards a healthier and happier life.","banner_url":"","registration_open_at":null,"registration_close_at":null,"event_date":null,"start_time":null,"end_time":null,"duration_minutes":60,"speaker_name":"","speaker_designation":""}'::jsonb,
    '{"show_details":true,"registration":true,"live":false,"attendance":false,"certificate":false,"referral":true,"whatsapp":false,"social":false,"countdown":true,"footer":true,"embedded_live":true,"backup_live":false}'::jsonb,
    '{"primary_url":"","backup_url":"","primary_button_text":"Join Live Webinar","backup_button_text":"Join Backup Stream","enable_primary":true,"enable_backup":false,"enable_embedded":true,"enable_open_youtube":true}'::jsonb,
    '{"min_percent":70,"interval_seconds":30,"start_buffer_minutes":5,"end_buffer_minutes":5,"enable_tracking":false,"enable_report":false,"enable_live_dashboard":false}'::jsonb,
    '{"enabled":false,"title":"Certificate of Participation","subtitle":"Online Yoga Webinar","background_url":"","signature_url":"","authorized_name":"","qr_url":"","prefix":"SSA","approval_mode":"manual","attendance_required":true}'::jsonb,
    '{"enabled":true,"share_template":"Join the Official Online Yoga Webinar organized by State Yog Board.\n\nTheme: {{Theme}}\nDate: {{Date}}\nTime: {{Time}}\n\nRegister Here: {{Link}}"}'::jsonb,
    '{"enabled":false,"url":"","button_text":"Join Our WhatsApp Channel"}'::jsonb,
    '{"facebook":{"enabled":false,"url":""},"instagram":{"enabled":false,"url":""},"youtube":{"enabled":false,"url":""},"telegram":{"enabled":false,"url":""},"whatsapp_channel":{"enabled":false,"url":""},"twitter":{"enabled":false,"url":""},"website":{"enabled":false,"url":""}}'::jsonb
  WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE slug = 'default');
EXCEPTION
  WHEN undefined_table THEN RAISE NOTICE 'SKIP events: table missing';
  WHEN undefined_column THEN
    BEGIN
      -- Fallback for schemas without the later-added venue column.
      INSERT INTO public.events
        (slug, reg_prefix, is_active, is_template, publish_status,
         general, features, live, attendance, certificate, referral, whatsapp, social)
      SELECT
        'default', 'SSADEF', true, false, 'published',
        '{"title":"Yog ane Dhyan Shibir","subtitle":"Seva Sushasan Abhiyan","theme":"Transform Your Life Through Yoga","description":"Join the Yog ane Dhyan Shibir organized by Seva Sushasan Abhiyan and begin your journey towards a healthier and happier life.","banner_url":"","registration_open_at":null,"registration_close_at":null,"event_date":null,"start_time":null,"end_time":null,"duration_minutes":60,"speaker_name":"","speaker_designation":""}'::jsonb,
        '{"show_details":true,"registration":true,"live":false,"attendance":false,"certificate":false,"referral":true,"whatsapp":false,"social":false,"countdown":true,"footer":true,"embedded_live":true,"backup_live":false}'::jsonb,
        '{"primary_url":"","backup_url":"","primary_button_text":"Join Live Webinar","backup_button_text":"Join Backup Stream","enable_primary":true,"enable_backup":false,"enable_embedded":true,"enable_open_youtube":true}'::jsonb,
        '{"min_percent":70,"interval_seconds":30,"start_buffer_minutes":5,"end_buffer_minutes":5,"enable_tracking":false,"enable_report":false,"enable_live_dashboard":false}'::jsonb,
        '{"enabled":false,"title":"Certificate of Participation","subtitle":"Online Yoga Webinar","background_url":"","signature_url":"","authorized_name":"","qr_url":"","prefix":"SSA","approval_mode":"manual","attendance_required":true}'::jsonb,
        '{"enabled":true,"share_template":"Join the Official Online Yoga Webinar organized by State Yog Board.\n\nTheme: {{Theme}}\nDate: {{Date}}\nTime: {{Time}}\n\nRegister Here: {{Link}}"}'::jsonb,
        '{"enabled":false,"url":"","button_text":"Join Our WhatsApp Channel"}'::jsonb,
        '{"facebook":{"enabled":false,"url":""},"instagram":{"enabled":false,"url":""},"youtube":{"enabled":false,"url":""},"telegram":{"enabled":false,"url":""},"whatsapp_channel":{"enabled":false,"url":""},"twitter":{"enabled":false,"url":""},"website":{"enabled":false,"url":""}}'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM public.events WHERE slug = 'default');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP events: % (%).', SQLERRM, SQLSTATE;
    END;
  WHEN OTHERS THEN RAISE NOTICE 'SKIP events: % (%).', SQLERRM, SQLSTATE;
END
$seed$;

-- ---------------------------------------------------------------------------
-- 7. Link the default event to the campaign (only if currently unlinked)
-- ---------------------------------------------------------------------------
DO $seed$
BEGIN
  UPDATE public.events
     SET campaign_id = (SELECT id FROM public.campaigns WHERE slug = 'seva-sushasan-abhiyan')
   WHERE slug = 'default'
     AND campaign_id IS NULL;
EXCEPTION
  WHEN undefined_table THEN RAISE NOTICE 'SKIP campaign link: campaigns or events table missing';
  WHEN undefined_column THEN RAISE NOTICE 'SKIP campaign link: campaign_id column missing (%).', SQLERRM;
END
$seed$;

-- ---------------------------------------------------------------------------
-- 8. event_reg_seq — one sequence row per non-template event (starts at 1)
-- ---------------------------------------------------------------------------
DO $seed$
BEGIN
  INSERT INTO public.event_reg_seq (event_id, next_val)
  SELECT id, 1
    FROM public.events
   WHERE coalesce(is_template, false) = false
  ON CONFLICT (event_id) DO NOTHING;
EXCEPTION
  WHEN undefined_table THEN RAISE NOTICE 'SKIP event_reg_seq: table missing';
  WHEN undefined_column THEN RAISE NOTICE 'SKIP event_reg_seq: column mismatch (%).', SQLERRM;
END
$seed$;

-- ============================================================================
-- VERIFICATION — run-always report (NEVER fails, even if tables are missing)
-- ============================================================================
DO $verify$
DECLARE
  v bigint;
  r record;
BEGIN
  SELECT count(*) INTO v FROM public.admin_users;
  RAISE NOTICE '[verify] admin_users total rows: %', v;
  SELECT count(*) INTO v FROM public.admin_users
   WHERE username = 'superadmin' AND role = 'super_admin' AND disabled = false;
  RAISE NOTICE '[verify] superadmin (super_admin, enabled) present: % (expect 1)', v;

  SELECT count(*) INTO v FROM public.districts;
  RAISE NOTICE '[verify] districts rows: % (expect 34)', v;

  SELECT count(*) INTO v FROM public.campaigns;
  RAISE NOTICE '[verify] campaigns rows: %', v;

  SELECT count(*) INTO v FROM public.events WHERE slug = 'default';
  RAISE NOTICE '[verify] default event present: % (expect 1)', v;
  SELECT publish_status, is_active, reg_prefix INTO r
    FROM public.events WHERE slug = 'default' LIMIT 1;
  IF r IS NOT NULL THEN
    RAISE NOTICE '[verify] default event -> publish_status: % | is_active: % | reg_prefix: %',
      r.publish_status, r.is_active, r.reg_prefix;
  END IF;

  SELECT count(*) INTO v FROM public.event_reg_seq
   WHERE event_id = (SELECT id FROM public.events WHERE slug = 'default');
  RAISE NOTICE '[verify] event_reg_seq rows for default event: % (expect 1)', v;

  SELECT count(*) INTO v FROM public.app_settings;
  RAISE NOTICE '[verify] app_settings rows: %', v;

  SELECT count(*) INTO v FROM public.site_settings;
  RAISE NOTICE '[verify] site_settings rows: %', v;
EXCEPTION
  WHEN OTHERS THEN RAISE NOTICE '[verify] partial: % (%).', SQLERRM, SQLSTATE;
END
$verify$;
