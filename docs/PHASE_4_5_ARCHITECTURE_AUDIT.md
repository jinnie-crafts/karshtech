# KARSH TECH — PHASE 4.5 ARCHITECTURE AUDIT
## Comprehensive Dynamic Media & Storage Inventory

**Date:** 2026-11-01  
**Milestone:** Phase 4.5 — Supabase-First Media Architecture  
**Repository:** `https://github.com/jinnie-crafts/karshtech.git`  
**Production Domain:** `https://tech.aadirishi.in`  
**Storage Provider:** Supabase Storage (`game-assets`, `product-assets`, `release-apks`)  
**Database Provider:** Supabase PostgreSQL (Postgres 15+)  

---

## 1. Executive Overview

This audit establishes the baseline for migrating Karsh Tech from a hybrid/filesystem-reliant media model to a **Supabase-First Media Architecture**. Under this architecture:
- **Supabase PostgreSQL** is the authoritative source for media metadata, object paths, ownership, associations, and reference integrity.
- **Supabase Storage** is the authoritative store for binary payloads (images, screenshots, avatars, and APKs).
- **Express Backend (Render)** acts as the secure control plane for authenticated uploads, deletions, reference validation, metadata queries, and streaming authenticated private APK downloads.
- **React Frontend (Vite)** consumes canonical URLs provided by backend APIs, rendering public images directly from Supabase CDN while routing private APK downloads through secure backend streaming.

---

## 2. Dynamic Media Source Inventory

| Category | Storage Object Name | Current Bucket | Visibility | MIME Type | File Size | SHA-256 Digest |
|---|---|---|---|---|---|---|
| **Screenshot** | `arrow_puzzle_screenshot_1.jpg` | `game-assets` | Public | `image/jpeg` | 475,994 B | `611f7c5e26922849fbda9666838a5d3f23ffcb249e083c27e8a9d1dd48e64757` |
| **Screenshot** | `arrow_puzzle_screenshot_2.jpg` | `game-assets` | Public | `image/jpeg` | 890,422 B | `1160356230f81d11ff9d23192419f71ee271dbce3c415444ca9fa484196c8135` |
| **Screenshot** | `arrow_puzzle_screenshot_3.jpg` | `game-assets` | Public | `image/jpeg` | 1,098,095 B | `15e8555e761614749cb964ce2f168d66cbccae95b11874251f987dbe6396e6d1` |
| **Screenshot** | `arrow_puzzle_screenshot_4.jpg` | `game-assets` | Public | `image/jpeg` | 223,036 B | `70fa67f1b6a7ee7fbb52f205c065f41aa1d5966373e32e887031fb6c085eb543` |
| **Screenshot** | `arrow_puzzle_screenshot_5.jpg` | `game-assets` | Public | `image/jpeg` | 609,095 B | `532f1709405ae650aa829ffdf35017088b9dd55ea0b16f39003507119ff086d4` |
| **Screenshot** | `arrow_puzzle_screenshot_6.jpg` | `game-assets` | Public | `image/jpeg` | 316,570 B | `45fb815349f76a5b4f6eefc464ef245e3f2fbfa556aee05dca009697f373ea7a` |
| **Team Avatar** | `avatar_aditya.png` | `game-assets` | Public | `image/png` | 1,025,265 B | `07e60b2eb76c4ca80ec4a9e536bbdb4015112f27914092fcdd1fe48c96766cb4` |
| **Team Avatar** | `avatar_harsh.png` | `game-assets` | Public | `image/png` | 1,277,844 B | `32e7b57fc680074c7e2b10a2665be5332f14c24388ffcbb3d8c11e5f8f533a1e` |
| **Team Avatar** | `avatar_komal.png` | `game-assets` | Public | `image/png` | 195,109 B | `d08ae6d50ff694c97ebc1a7b75f56b27e8a34a9aa536b306b3e8ecab008f51ca` |
| **Release APK** | `arrow-puzzle-release-v1.0.0.apk` | `release-apks` | Private | `application/vnd.android.package-archive` | 2,885,749 B | `9b3ff898ef44030616b23d9a101f3fcf2e3a7cf6b8f15217983ea4e6e6a1005a` |

---

## 3. Frontend Image Reference Audit

| Component / Page | Code Location | Referenced Expression / Target | Purpose | Fallback Expression |
|---|---|---|---|---|
| `StudioPage.tsx` | Line 27 | `'/uploads/images/avatar_harsh.png?v=1.0.1'` | Harsh Team Avatar | Monogram Icon |
| `StudioPage.tsx` | Line 34 | `'/uploads/images/avatar_komal.png?v=1.0.1'` | Komal Team Avatar | Monogram Icon |
| `StudioPage.tsx` | Line 41 | `'/uploads/images/avatar_aditya.png?v=1.0.1'` | Aditya Team Avatar | Monogram Icon |
| `GameCard.tsx` | Line 18 | `game.cover_image` | Game Card Thumbnail | `'/uploads/images/default_cover.jpg'` |
| `HomePage.tsx` | Line 484 | `featuredGame.cover_image` | Hero Featured Game Cover | `'/uploads/images/default_cover.jpg'` |
| `GameDetailPage.tsx` | Line 285 | `game.cover_image` | Game Detail Hero Banner | None (assumes valid string) |
| `GameDetailPage.tsx` | Line 328 | `shot` (from `game.screenshots`) | Screenshot Gallery Thumbnails | None |
| `ScreenshotModal.tsx` | Line 89, 108 | `screenshots[currentIndex]` | Lightbox Fullscreen View | None |
| `ProductsPage.tsx` | Line 237 | `product.cover_image` | Product Grid Thumbnail | `'/brand/karsh-tech-full.png'` |
| `ProductDetailPage.tsx` | Line 144, 179 | `product.cover_image`, `lightboxImage` | Cover & Lightbox Image | `'/brand/karsh-tech-full.png'` |
| `ProductDetailPage.tsx` | Line 344 | `img` (from `product.gallery`) | Product Gallery Grid | None |
| `AdminGamesPage.tsx` | Line 136 | `game.cover_image` | Admin Game Table Thumbnail | `'/uploads/images/default_cover.jpg'` |
| `AdminProductsPage.tsx` | Line 360 | `product.cover_image` | Admin Product Table Thumbnail | `'/brand/karsh-tech-k.png'` |
| `AdminMediaPage.tsx` | Line 695, 819, 1461 | `asset.url` | Media Manager Grid / Table / Drawer | Placeholder Icon |
| `GameFormModal.tsx` | Line 32, 416 | `coverImage`, `screenshots` | Game Edit Form Previews | `'/uploads/images/default_cover.jpg'` |
| `ProductFormModal.tsx` | Line 53, 398 | `coverImage`, `gallery` | Product Edit Form Previews | `'/brand/karsh-tech-k.png'` |

---

## 4. API Response Media URL & Path Audit

| Endpoint | Method | Response Payload Field | Current Format in DB / API | Target Canonical Format |
|---|---|---|---|---|
| `/api/games` | GET | `game.cover_image` | `"/uploads/images/arrow_puzzle_screenshot_1.jpg"` | Canonical CDN URL or Object Path |
| `/api/games` | GET | `game.banner_image` | `"/uploads/images/arrow_puzzle_screenshot_2.jpg"` | Canonical CDN URL or Object Path |
| `/api/games` | GET | `game.screenshots` | Array of `"/uploads/images/..."` | Array of Canonical CDN URLs |
| `/api/games/:slug` | GET | `game.cover_image`, `game.screenshots` | Array of `"/uploads/images/..."` | Canonical CDN URLs |
| `/api/products` | GET | `product.cover_image`, `product.gallery` | String / Array (empty or CDN URL) | Canonical CDN URLs |
| `/api/products/:slug` | GET | `product.cover_image`, `product.gallery` | String / Array (empty or CDN URL) | Canonical CDN URLs |
| `/api/releases/:id/download` | GET | Streaming Binary | Express 302 or stream from Storage | Express streaming from `release-apks` |
| `/api/admin/media` | GET | `assets[].url` | Full Supabase CDN URL (`https://...`) | Preserved (Canonical CDN URL) |
| `/api/admin/media` | GET | `assets[].path` | Bare object name (`arrow_puzzle_...jpg`) | Preserved (Canonical Object Path) |
| `/api/admin/upload/image` | POST | `url`, `filename` | CDN URL + Object Key | Preserved |
| `/api/admin/upload/apk` | POST | `filename`, `url: null` | Object Key + null URL | Preserved |

---

## 5. Database Schema & Field Audit

| Table | Column | Type | Nullable | Current Contents / Values | Target Supabase-First Representation |
|---|---|---|---|---|---|
| `games` | `cover_image` | `TEXT` | `NOT NULL` | `"/uploads/images/arrow_puzzle_screenshot_1.jpg"` | Canonical URL or Storage Object Path |
| `games` | `banner_image` | `TEXT` | `NULL` | `"/uploads/images/arrow_puzzle_screenshot_2.jpg"` | Canonical URL or Storage Object Path |
| `games` | `screenshots` | `TEXT[]` | `NOT NULL` | Array of 6 `"/uploads/images/..."` strings | Array of Canonical URLs / Object Paths |
| `products` | `cover_image` | `TEXT` | `NOT NULL` | Empty or Supabase CDN URL | Canonical CDN URL or Storage Object Path |
| `products` | `gallery` | `TEXT[]` | `NOT NULL` | Empty or Array of CDN URLs | Array of Canonical URLs / Object Paths |
| `releases` | `apk_filename` | `TEXT` | `NOT NULL` | `"arrow-puzzle-release-v1.0.0.apk"` | Canonical Object Path in `release-apks` |
| `releases` | `apk_download_url` | `TEXT` | `NOT NULL` | `"/api/releases/rel_1793379796430_yy9yf/download"` | Relative Express Streaming Endpoint |
| `studio_settings` | `avatar_*` | N/A | N/A | None (currently hardcoded in React) | Managed via `media_assets` / settings |

---

## 6. Filesystem Dependencies & Fallbacks

1. **`server/uploads/images/`:**
   - Bundles local copies of the 6 Arrow Puzzle screenshots and 3 team avatars.
   - Used by `server/paths.ts` (`DEFAULT_REPO_UPLOADS_DIR`) for bootstrap syncing.
   - Used by `server/index.ts` static middleware (`app.use('/uploads', express.static(UPLOADS_DIR))`).
2. **`server/uploads/apks/`:**
   - Contains historical copy of `arrow-puzzle-release-v1.0.0.apk`.
   - Used only as development fallback if `SUPABASE_SECRET_KEY` is not present.
3. **Legacy Resolution Route (`/uploads/images/:filename` in `server/index.ts`):**
   - Intercepts requests to `/uploads/images/:filename`.
   - Checks `fs.existsSync(localFile)`. If present, calls `next()` to serve from disk.
   - If missing from disk, redirects (302) to Supabase Storage CDN URL (`storageService.getPublicUrl('game-assets', safeFilename)`).
   - **Flaw in current implementation:** Because files exist on disk, traffic hits the Express node process instead of hitting Supabase Storage CDN directly.

---

## 7. Migration Objectives for Phase 4.5

1. **Schema Introduction (`media_assets` table):**
   - Create a central `media_assets` table in PostgreSQL to track all objects across the 3 buckets with SHA-256 digests, MIME types, file sizes, bucket names, and entity references.
2. **Canonical Media Service (`server/services/MediaService.ts`):**
   - Encapsulate canonical URL resolution, reference checking, and metadata synchronization.
   - Resolve any image reference (whether legacy relative `/uploads/images/foo.jpg`, bare key `foo.jpg`, or full CDN URL) into its authoritative CDN URL.
3. **API Normalization:**
   - When `/api/games`, `/api/games/:slug`, `/api/products`, etc. return records, resolve `cover_image`, `banner_image`, `screenshots`, and `gallery` to their canonical Supabase CDN URLs so frontend clients load assets directly from Supabase.
4. **Transparent Legacy Compatibility:**
   - Maintain the `/uploads/images/:filename` route, but invert its priority: redirect or proxy to Supabase Storage CDN URL, using local disk only as an emergency offline development fallback.
   - Support requests for both `game-assets` and `product-assets` via legacy paths.
5. **Idempotent Data Migration:**
   - Provide `scripts/migrate_media_to_supabase.mjs` to register all 10 existing production assets into `media_assets`, verify SHA-256 checksums, and update legacy database references safely.
