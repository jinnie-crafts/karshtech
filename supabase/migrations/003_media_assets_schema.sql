-- ==============================================================================
-- KARSH TECH — SUPABASE MEDIA ASSETS RELATIONAL SCHEMA
-- Migration: 003_media_assets_schema.sql
-- Description: Creates the media_assets table for centralized metadata tracking,
--              cryptographic SHA-256 integrity, categorization, and ownership.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. MEDIA ASSETS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL CHECK (bucket IN ('game-assets', 'product-assets', 'release-apks')),
  object_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('screenshot', 'cover', 'banner', 'avatar', 'gallery', 'apk', 'other')) DEFAULT 'other',
  is_protected BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_media_assets_bucket_path UNIQUE (bucket, object_path)
);

-- ------------------------------------------------------------------------------
-- 2. INDEXES FOR PERFORMANCE & SEARCH
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_media_assets_bucket ON media_assets (bucket);
CREATE INDEX IF NOT EXISTS idx_media_assets_category ON media_assets (category);
CREATE INDEX IF NOT EXISTS idx_media_assets_sha256 ON media_assets (sha256);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_is_protected ON media_assets (is_protected);

-- ------------------------------------------------------------------------------
-- 3. AUTOMATIC UPDATED_AT TRIGGER
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_media_assets_updated_at ON media_assets;
CREATE TRIGGER trg_media_assets_updated_at
BEFORE UPDATE ON media_assets
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

-- Public can inspect public assets (game-assets, product-assets)
DROP POLICY IF EXISTS "Public can view public media assets" ON media_assets;
CREATE POLICY "Public can view public media assets"
ON media_assets FOR SELECT
USING (bucket IN ('game-assets', 'product-assets'));

-- Private APK assets in release-apks are strictly hidden from public PostgREST queries
DROP POLICY IF EXISTS "No public access to private release apks in media_assets" ON media_assets;
CREATE POLICY "No public access to private release apks in media_assets"
ON media_assets FOR SELECT
USING (bucket != 'release-apks');

-- ------------------------------------------------------------------------------
-- 5. ROLE PERMISSIONS
-- ------------------------------------------------------------------------------
GRANT ALL ON TABLE public.media_assets TO postgres, service_role;
GRANT SELECT ON TABLE public.media_assets TO anon, authenticated;
