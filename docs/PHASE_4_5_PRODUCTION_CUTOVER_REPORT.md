# KARSH TECH — PHASE 4.5 PRODUCTION CUTOVER REPORT
## Supabase-First Media Architecture Migration & Database Normalization

**Date:** November 1, 2026  
**Executed By:** Antigravity AI Engineering (Authorized by Project Owner)  
**Database Host:** `aws-0-ap-south-1.pooler.supabase.com:5432`  
**Supabase Project ID:** `dqdgotivffhvtpwjqlsf`  
**Target Environment:** Production PostgreSQL + Supabase Storage + Express Backend  
**Status:** MIGRATION EXECUTED SUCCESSFULLY & VERIFIED  

---

## 1. Executive Summary

In accordance with explicit authorization from the project owner, Phase 4.5 has achieved the full production cutover to a **Supabase-First Media Architecture**:
1. **Migration 003 Applied:** Created the `media_assets` relational table with strict integrity constraints, 6 performance indexes, automated timestamp triggers, and Row Level Security (RLS) policies.
2. **Authoritative Media Cataloging:** Cataloged all 10 existing production assets across `game-assets` (public) and `release-apks` (private) into `media_assets` with cryptographic SHA-256 digests.
3. **Reference Normalization:** Safely upgraded database media references in `games` from legacy `/uploads/images/` paths to canonical, edge-cached Supabase Storage CDN URLs (`https://dqdgotivffhvtpwjqlsf.supabase.co/storage/v1/object/public/game-assets/...`).
4. **Zero Data Loss & Invariants Preserved:** Zero local or cloud files were deleted; Arrow Puzzle APK download count remains strictly 7; all admin credentials and session architectures remained untouched.

---

## 2. PostgreSQL Schema Execution (`003_media_assets_schema.sql`)

### 2.1 Table Structure
The `public.media_assets` table was created with the following schema:
```sql
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
```

### 2.2 Verified Indexes on `media_assets`
- `media_assets_pkey` (Primary Key on `id`)
- `uq_media_assets_bucket_path` (Unique composite on `bucket, object_path`)
- `idx_media_assets_bucket` (B-tree on `bucket`)
- `idx_media_assets_category` (B-tree on `category`)
- `idx_media_assets_sha256` (B-tree on `sha256`)
- `idx_media_assets_created_at` (B-tree on `created_at DESC`)
- `idx_media_assets_is_protected` (B-tree on `is_protected`)

### 2.3 Row Level Security & Triggers
- Trigger `trg_media_assets_updated_at` active on updates.
- Policy `"Public can view public media assets"` active for `game-assets` and `product-assets`.
- Policy `"No public access to private release apks in media_assets"` active to prevent public leak of APK records.
- Permissions: `GRANT ALL ON TABLE public.media_assets TO postgres, service_role;` and `GRANT SELECT ON TABLE public.media_assets TO anon, authenticated;`.

---

## 3. Production Media Cataloging & SHA-256 Digest Verification

All 10 production assets residing in Supabase Storage were cataloged directly into `media_assets`:

| Bucket | Object Path | Category | Size (Bytes) | Protected | SHA-256 Checksum (Hex Prefix) |
|:---|:---|:---:|:---:|:---:|:---|
| `game-assets` | `arrow_puzzle_screenshot_1.jpg` | `screenshot` | 475,994 | Yes | `e837b9482c...` |
| `game-assets` | `arrow_puzzle_screenshot_2.jpg` | `screenshot` | 890,422 | No | `edac3c8e8c...` |
| `game-assets` | `arrow_puzzle_screenshot_3.jpg` | `screenshot` | 1,098,095 | No | `5e81d25d77...` |
| `game-assets` | `arrow_puzzle_screenshot_4.jpg` | `screenshot` | 223,036 | No | `107ddcf376...` |
| `game-assets` | `arrow_puzzle_screenshot_5.jpg` | `screenshot` | 609,095 | No | `824a23a9bd...` |
| `game-assets` | `arrow_puzzle_screenshot_6.jpg` | `screenshot` | 316,570 | No | `a3ebda8180...` |
| `game-assets` | `avatar_aditya.png` | `avatar` | 1,025,265 | Yes | `3b9ade1d81...` |
| `game-assets` | `avatar_harsh.png` | `avatar` | 1,277,844 | Yes | `7ed456b318...` |
| `game-assets` | `avatar_komal.png` | `avatar` | 195,109 | Yes | `d95fa11e8e...` |
| `release-apks` | `arrow-puzzle-release-v1.0.0.apk` | `apk` | 2,885,749 | Yes | `c0646db782...` |

---

## 4. Database Reference Normalization

### Before Migration:
```json
{
  "id": "game_1793379796423_xw5nx",
  "title": "Arrow Puzzle",
  "cover_image": "/uploads/images/arrow_puzzle_screenshot_1.jpg",
  "screenshots": [
    "/uploads/images/arrow_puzzle_screenshot_1.jpg",
    "/uploads/images/arrow_puzzle_screenshot_2.jpg",
    "/uploads/images/arrow_puzzle_screenshot_3.jpg",
    "/uploads/images/arrow_puzzle_screenshot_4.jpg",
    "/uploads/images/arrow_puzzle_screenshot_5.jpg",
    "/uploads/images/arrow_puzzle_screenshot_6.jpg"
  ]
}
```

### After Migration:
```json
{
  "id": "game_1793379796423_xw5nx",
  "title": "Arrow Puzzle",
  "cover_image": "https://dqdgotivffhvtpwjqlsf.supabase.co/storage/v1/object/public/game-assets/arrow_puzzle_screenshot_1.jpg",
  "screenshots": [
    "https://dqdgotivffhvtpwjqlsf.supabase.co/storage/v1/object/public/game-assets/arrow_puzzle_screenshot_1.jpg",
    "https://dqdgotivffhvtpwjqlsf.supabase.co/storage/v1/object/public/game-assets/arrow_puzzle_screenshot_2.jpg",
    "https://dqdgotivffhvtpwjqlsf.supabase.co/storage/v1/object/public/game-assets/arrow_puzzle_screenshot_3.jpg",
    "https://dqdgotivffhvtpwjqlsf.supabase.co/storage/v1/object/public/game-assets/arrow_puzzle_screenshot_4.jpg",
    "https://dqdgotivffhvtpwjqlsf.supabase.co/storage/v1/object/public/game-assets/arrow_puzzle_screenshot_5.jpg",
    "https://dqdgotivffhvtpwjqlsf.supabase.co/storage/v1/object/public/game-assets/arrow_puzzle_screenshot_6.jpg"
  ]
}
```

---

## 5. Invariant & Security Verification

1. **Release Download Count:** Verified strictly unchanged at **7** (`rel_1793379796430_yy9yf`).
2. **Private APK Protection:** `arrow-puzzle-release-v1.0.0.apk` is registered in `release-apks` private bucket and protected from public CDN URL resolution or generic administrative deletion.
3. **Core Database Rows:** Studio settings (`karshhtech@gmail.com`), admin user records, and product tables remained 100% intact.
4. **Zero Asset Deletions:** No source files in `server/uploads/` or cloud objects in Supabase Storage were removed or modified.
5. **Full Suite Regression:** 167 automated test specifications across 5 suites pass with zero regressions.
