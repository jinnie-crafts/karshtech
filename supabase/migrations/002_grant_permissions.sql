-- ==============================================================================
-- KARSH TECH — SUPABASE PERMISSIONS GRANT MIGRATION
-- Migration: 002_grant_permissions.sql
-- Description: Grants table, sequence, and routine privileges on public schema
--              to service_role, postgres, and client roles (anon, authenticated).
-- ==============================================================================

-- 1. Grant full administrative privileges to service_role and postgres
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

-- 2. Ensure future tables created in public schema inherit these privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, service_role;

-- 3. Grant SELECT privileges to client roles for public reads (RLS filters rows)
GRANT SELECT ON TABLE public.games, public.releases, public.products, public.studio_settings TO anon, authenticated;
