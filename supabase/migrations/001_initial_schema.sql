-- ==============================================================================
-- KARSH TECH — SUPABASE POSTGRESQL INITIAL SCHEMA MIGRATION
-- Migration: 001_initial_schema.sql
-- Description: Creates relational schema for users, games, releases, products,
--              and studio settings. Maps 1:1 with existing TypeScript interfaces.
-- ==============================================================================

-- Enable UUID extension if needed in future
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. USERS TABLE (Administrative Accounts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for case-insensitive username lookup
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

-- ------------------------------------------------------------------------------
-- 2. GAMES TABLE (Game Catalog)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  genre TEXT[] NOT NULL DEFAULT '{}',
  platforms TEXT[] NOT NULL DEFAULT '{Android}',
  status TEXT NOT NULL CHECK (status IN ('Available', 'Coming Soon', 'Updated', 'In Beta')) DEFAULT 'Available',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  cover_image TEXT NOT NULL DEFAULT '',
  banner_image TEXT,
  screenshots TEXT[] NOT NULL DEFAULT '{}',
  trailer_url TEXT,
  features TEXT[] NOT NULL DEFAULT '{}',
  controls TEXT[] NOT NULL DEFAULT '{}',
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  developer TEXT NOT NULL DEFAULT 'Karsh Tech Studio',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_slug ON games (slug);
CREATE INDEX IF NOT EXISTS idx_games_status ON games (status);
CREATE INDEX IF NOT EXISTS idx_games_featured ON games (featured);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games (created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. RELEASES TABLE (Android APK Packages)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS releases (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  version_name TEXT NOT NULL,
  version_code INTEGER NOT NULL DEFAULT 1,
  release_date DATE NOT NULL DEFAULT CURRENT_DATE,
  release_notes TEXT NOT NULL DEFAULT '',
  apk_filename TEXT NOT NULL,
  original_filename TEXT,
  apk_file_size BIGINT NOT NULL DEFAULT 0,
  apk_download_url TEXT NOT NULL DEFAULT '',
  min_sdk INTEGER NOT NULL DEFAULT 26,
  target_sdk INTEGER NOT NULL DEFAULT 35,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  download_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_releases_game_id ON releases (game_id);
CREATE INDEX IF NOT EXISTS idx_releases_version_code ON releases (version_code DESC);
CREATE INDEX IF NOT EXISTS idx_releases_is_published ON releases (is_published);
CREATE INDEX IF NOT EXISTS idx_releases_game_published ON releases (game_id, is_published, version_code DESC);

-- ------------------------------------------------------------------------------
-- 4. PRODUCTS TABLE (Dynamic Products Management)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('Websites', 'Web Applications', 'Mobile Applications', 'Games', 'Custom Software')),
  cover_image TEXT NOT NULL DEFAULT '',
  gallery TEXT[] NOT NULL DEFAULT '{}',
  technologies TEXT[] NOT NULL DEFAULT '{}',
  project_url TEXT,
  github_url TEXT,
  play_store_url TEXT,
  apk_download_url TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('Web', 'Android', 'iOS', 'Desktop', 'Cross-platform')) DEFAULT 'Web',
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Published')) DEFAULT 'Draft',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products (featured);

-- ------------------------------------------------------------------------------
-- 5. STUDIO SETTINGS TABLE (Single-Row Configuration)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studio_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  studio_name TEXT NOT NULL DEFAULT 'Karsh Tech',
  tagline TEXT NOT NULL DEFAULT 'Turning Ideas into Digital Reality',
  contact_email TEXT NOT NULL DEFAULT 'karshhtech@gmail.com',
  announcement TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  initial_seeded BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed default settings if not exists
INSERT INTO studio_settings (id, studio_name, tagline, contact_email, updated_at, initial_seeded)
VALUES (1, 'Karsh Tech', 'Turning Ideas into Digital Reality', 'karshhtech@gmail.com', NOW(), TRUE)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_games_updated_at ON games;
CREATE TRIGGER trg_games_updated_at
BEFORE UPDATE ON games
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_settings ENABLE ROW LEVEL SECURITY;

-- Note: The Express backend connects with SUPABASE_SECRET_KEY (Service Role)
-- or direct DATABASE_URL, which bypasses RLS automatically.
-- The policies below protect public/anonymous access via PostgREST if queried directly.

-- Public Read Policies
DROP POLICY IF EXISTS "Public can view available games" ON games;
CREATE POLICY "Public can view available games"
ON games FOR SELECT
USING (status IN ('Available', 'Updated', 'Coming Soon'));

DROP POLICY IF EXISTS "Public can view published releases" ON releases;
CREATE POLICY "Public can view published releases"
ON releases FOR SELECT
USING (is_published = TRUE);

DROP POLICY IF EXISTS "Public can view published products" ON products;
CREATE POLICY "Public can view published products"
ON products FOR SELECT
USING (status = 'Published');

DROP POLICY IF EXISTS "Public can view studio settings" ON studio_settings;
CREATE POLICY "Public can view studio settings"
ON studio_settings FOR SELECT
USING (TRUE);

-- Users table is strictly hidden from public PostgREST queries
DROP POLICY IF EXISTS "No public access to users" ON users;
CREATE POLICY "No public access to users"
ON users FOR SELECT
USING (FALSE);

-- ------------------------------------------------------------------------------
-- 8. SUPABASE STORAGE BUCKETS INITIALIZATION
-- ------------------------------------------------------------------------------
-- Insert storage buckets if storage schema exists (standard in Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    -- Public game assets (covers, screenshots, team avatars)
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'game-assets',
      'game-assets',
      TRUE,
      15728640, -- 15 MB
      ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
    )
    ON CONFLICT (id) DO UPDATE SET public = TRUE;

    -- Public product assets (covers, galleries)
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'product-assets',
      'product-assets',
      TRUE,
      15728640, -- 15 MB
      ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
    )
    ON CONFLICT (id) DO UPDATE SET public = TRUE;

    -- Private release APK packages
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'release-apks',
      'release-apks',
      FALSE,
      157286400, -- 150 MB (Requires Supabase Pro tier for files > 50 MB)
      ARRAY['application/vnd.android.package-archive', 'application/octet-stream']
    )
    ON CONFLICT (id) DO UPDATE SET public = FALSE;
  END IF;
END $$;
