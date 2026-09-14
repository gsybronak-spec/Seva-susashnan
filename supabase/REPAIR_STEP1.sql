-- ============================================================
-- REPAIR SCRIPT — run this in the Supabase SQL Editor FIRST,
-- then re-run 0001_init_consolidated.sql to finish seeding.
--
-- WHY THIS EXISTS
-- Diagnosis of the production project found:
--   1. Tables created by the migration exist, but the API roles
--      (service_role via the sb_secret_ key, anon via sb_publishable_)
--      get "permission denied" (42501) on the three oldest tables
--      (events, app_settings, event_notices). Cause: those tables were
--      created under a different owner and never granted to the
--      standard Supabase API roles. Newer tables were created correctly.
--   2. Three tables are missing entirely: organisations,
--      partners_forms (the migration's name; older installs may call
--      it partner_forms), contact_messages — plus their dependent
--      objects further down the file never applied.
-- This script fixes both so the main migration can finish cleanly.
-- ============================================================

-- ---------- 1. Ownership / grants repair (fixes 42501) ----------
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
    ALTER TABLE public.events OWNER TO postgres;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    ALTER TABLE public.app_settings OWNER TO postgres;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_notices') THEN
    ALTER TABLE public.event_notices OWNER TO postgres;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Make future objects inherit the same grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- ---------- 2. Missing tables (only what the main migration needs) ----------

CREATE TABLE IF NOT EXISTS public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  logo_url text,
  description text,
  contact_info text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partners_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text,
  subject text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- 3. Enable RLS to match the project convention ----------
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- ---------- 4. Reload the API schema cache so new tables are visible ----------
NOTIFY pgrst, 'reload schema';
