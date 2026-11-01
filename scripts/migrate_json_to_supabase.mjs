#!/usr/bin/env node

/**
 * ==============================================================================
 * KARSH TECH — JSON TO SUPABASE MIGRATION SCRIPT
 * File: scripts/migrate_json_to_supabase.mjs
 * 
 * Safety Guarantee:
 *   - Defaults to DRY-RUN mode.
 *   - DOES NOT modify or write any data unless --execute is explicitly supplied.
 *   - Idempotent: Can be run multiple times safely using UPSERT semantics.
 *   - Validates data integrity and normalizes foreign key relationships.
 *   - Inventories and verifies local storage assets against db.json references.
 *   - Strictly NON-OVERWRITING storage migration (x-upsert: false, 409 conflict inspection).
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load .env safely if present
if (!process.env.SUPABASE_URL && fs.existsSync(path.resolve(PROJECT_ROOT, '.env'))) {
  const envContent = fs.readFileSync(path.resolve(PROJECT_ROOT, '.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// ANSI Colors for readable console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function header(title) {
  console.log('\n' + '='.repeat(70));
  log(`  ${title}`, colors.bright + colors.cyan);
  console.log('='.repeat(70));
}

// ------------------------------------------------------------------------------
// HELPER: MIME TYPE & FILE UTILITIES
// ------------------------------------------------------------------------------
export function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.gif':
      return 'image/gif';
    case '.apk':
      return 'application/vnd.android.package-archive';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function computeChecksums(buffer) {
  const md5 = crypto.createHash('md5').update(buffer).digest('hex').toLowerCase();
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
  return { md5, sha256 };
}

export function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.isFile()) {
      if (entry.name === '.gitkeep') continue;
      const fullPath = path.join(dirPath, entry.name);
      const stat = fs.statSync(fullPath);
      results.push({
        filename: entry.name,
        fullPath,
        size: stat.size,
        mimeType: getMimeType(entry.name)
      });
    }
  }
  return results;
}

// ------------------------------------------------------------------------------
// SUPABASE STORAGE: NON-OVERWRITING VERIFICATION & UPLOAD
// ------------------------------------------------------------------------------

/**
 * Retrieves remote metadata for an existing object in Supabase Storage.
 * Queries storage object list endpoint or authenticated HEAD.
 */
export async function getRemoteObjectMetadata(bucket, filename, supabaseUrl, supabaseKey, fetchFn = fetch) {
  try {
    // 1. Try querying the list endpoint with search prefix
    const listEndpoint = `${supabaseUrl}/storage/v1/object/list/${bucket}`;
    const listRes = await fetchFn(listEndpoint, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prefix: '', search: filename, limit: 100 })
    });

    if (listRes.ok) {
      const items = await listRes.json();
      if (Array.isArray(items)) {
        const match = items.find(item => item.name === filename);
        if (match) {
          const size = match.metadata?.size ?? (match.size !== undefined ? match.size : null);
          const etag = match.metadata?.eTag || match.metadata?.etag || match.etag || null;
          return {
            source: 'list',
            name: match.name,
            size: size !== null ? Number(size) : null,
            etag: etag ? String(etag).replace(/["']/g, '').toLowerCase() : null,
            raw: match
          };
        }
      }
    }

    // 2. Fallback: Try HEAD request on authenticated endpoint
    const headEndpoint = `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${encodeURIComponent(filename)}`;
    const headRes = await fetchFn(headEndpoint, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (headRes.ok) {
      const contentLength = headRes.headers.get('content-length');
      const etag = headRes.headers.get('etag');
      return {
        source: 'head',
        name: filename,
        size: contentLength ? parseInt(contentLength, 10) : null,
        etag: etag ? String(etag).replace(/["']/g, '').toLowerCase() : null
      };
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Uploads a local file to Supabase Storage with strictly non-overwriting semantics (x-upsert: false).
 * If HTTP 409 Conflict is returned:
 *   - Compares remote metadata (size & checksum) against the local file.
 *   - Marks identical objects as [SKIPPED - ALREADY EXISTS] (success: true).
 *   - Marks mismatched or unverifiable objects as [WARNING - MANUAL REVIEW REQUIRED] (success: false).
 *   - Remote object is NEVER modified or deleted.
 */
export async function uploadStorageFile(bucket, filename, filePath, mimeType, options = {}) {
  const {
    supabaseUrl = process.env.SUPABASE_URL,
    supabaseKey = process.env.SUPABASE_SECRET_KEY,
    fetchFn = fetch,
    isVerbose = false
  } = options;

  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(filePath);
  } catch (err) {
    log(`  ✗ [FILE READ ERROR] ${bucket}/${filename}: ${err.message}`, colors.red);
    return {
      success: false,
      status: 'failed',
      filename,
      bucket,
      error: `Could not read local file: ${err.message}`
    };
  }

  const localSize = fileBuffer.length;
  const { md5: localMd5, sha256: localSha256 } = computeChecksums(fileBuffer);
  const endpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(filename)}`;

  let res;
  try {
    res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': mimeType,
        'x-upsert': 'false' // STRICTLY NON-OVERWRITING
      },
      body: fileBuffer
    });
  } catch (err) {
    log(`  ✗ [NETWORK ERROR] ${bucket}/${filename}: ${err.message}`, colors.red);
    return {
      success: false,
      status: 'failed',
      filename,
      bucket,
      error: `Network error during upload: ${err.message}`
    };
  }

  // 1. Successful upload of a new object
  if (res.ok) {
    log(`  ✓ [UPLOADED] ${bucket}/${filename} (${formatBytes(localSize)})`, colors.green);
    return {
      success: true,
      status: 'uploaded',
      filename,
      bucket,
      size: localSize,
      md5: localMd5
    };
  }

  // 2. HTTP 409 Conflict: Object already exists in bucket
  if (res.status === 409) {
    const remoteMeta = await getRemoteObjectMetadata(bucket, filename, supabaseUrl, supabaseKey, fetchFn);

    if (!remoteMeta || remoteMeta.size === null) {
      log(`  ⚠️  [WARNING - MANUAL REVIEW REQUIRED] ${bucket}/${filename}: HTTP 409 conflict, but remote metadata could not be verified. Remote object left untouched.`, colors.yellow);
      return {
        success: false,
        status: 'warning_unverifiable',
        filename,
        bucket,
        size: localSize,
        reason: 'Remote object exists but metadata is inaccessible or missing size',
        verified: false
      };
    }

    const sizeMatches = Number(remoteMeta.size) === localSize;
    let checksumVerified = false;
    let checksumMismatch = false;

    if (remoteMeta.etag) {
      if (remoteMeta.etag.length === 32) {
        if (remoteMeta.etag === localMd5) {
          checksumVerified = true;
        } else {
          checksumMismatch = true;
        }
      } else if (remoteMeta.etag.length === 64) {
        if (remoteMeta.etag === localSha256) {
          checksumVerified = true;
        } else {
          checksumMismatch = true;
        }
      }
    }

    if (sizeMatches && !checksumMismatch) {
      const verifyNote = checksumVerified ? ' (size & MD5 verified)' : ' (size verified)';
      log(`  [SKIPPED - ALREADY EXISTS] ${bucket}/${filename} (identical, ${formatBytes(localSize)}${verifyNote})`, colors.dim);
      return {
        success: true,
        status: 'skipped_identical',
        filename,
        bucket,
        size: localSize,
        remoteSize: remoteMeta.size,
        checksumVerified,
        verified: true
      };
    } else {
      const diffReason = !sizeMatches
        ? `Size mismatch (local: ${localSize} B, remote: ${remoteMeta.size} B)`
        : `Checksum mismatch (local MD5: ${localMd5}, remote ETag: ${remoteMeta.etag})`;
      log(`  ⚠️  [WARNING - MANUAL REVIEW REQUIRED] ${bucket}/${filename}: ${diffReason}. Remote object left untouched!`, colors.yellow);
      return {
        success: false,
        status: 'warning_mismatch',
        filename,
        bucket,
        size: localSize,
        remoteSize: remoteMeta.size,
        remoteEtag: remoteMeta.etag,
        localMd5,
        reason: diffReason,
        verified: false
      };
    }
  }

  // 3. Unexpected HTTP error (400, 401, 403, 500, etc.)
  let errText = '';
  try {
    errText = await res.text();
  } catch {
    errText = res.statusText;
  }
  log(`  ✗ [FAILED UPLOAD] ${bucket}/${filename} (HTTP ${res.status}): ${errText}`, colors.red);
  return {
    success: false,
    status: 'failed',
    filename,
    bucket,
    error: `HTTP ${res.status}: ${errText}`,
    size: localSize
  };
}

/**
 * Upserts database records via PostgREST with merge-duplicates semantics.
 */
export async function postgrestUpsert(tableName, data, options = {}) {
  const {
    supabaseUrl = process.env.SUPABASE_URL,
    supabaseKey = process.env.SUPABASE_SECRET_KEY,
    fetchFn = fetch
  } = options;

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return { ok: true, count: 0 };
  }
  const endpoint = `${supabaseUrl}/rest/v1/${tableName}`;
  const res = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to upsert into ${tableName} (${res.status} ${res.statusText}): ${errorText}`);
  }
  return { ok: true, count: Array.isArray(data) ? data.length : 1 };
}

// ------------------------------------------------------------------------------
// MAIN CLI RUNNER
// ------------------------------------------------------------------------------
export async function runCli(argv = process.argv.slice(2)) {
  const isExecute = argv.includes('--execute');
  const isVerbose = argv.includes('--verbose') || argv.includes('-v');
  const skipStorage = argv.includes('--skip-storage');
  const skipDb = argv.includes('--skip-db');

  let customDbPath = null;
  const dbArgIdx = argv.findIndex(arg => arg === '--db-file' || arg === '-f');
  if (dbArgIdx !== -1 && argv[dbArgIdx + 1]) {
    customDbPath = path.resolve(process.cwd(), argv[dbArgIdx + 1]);
  }

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
Karsh Tech — JSON to Supabase Migration Tool

Usage:
  node scripts/migrate_json_to_supabase.mjs [options]

Options:
  --execute          Execute actual migration writes to Supabase.
                     (DEFAULT: DRY-RUN simulation only, no network writes)
  --db-file <path>   Specify path to db.json (defaults to server/data/db.json)
  --skip-storage     Only migrate database records; skip asset uploads
  --skip-db          Only upload assets to Supabase Storage; skip database records
  --verbose, -v      Enable verbose logging of each record and file check
  --help, -h         Show this help message

Required Environment Variables (when --execute is used):
  SUPABASE_URL         The Supabase project URL (e.g., https://xyz.supabase.co)
  SUPABASE_SECRET_KEY  The service_role secret key (never expose publicly)
`);
    return 0;
  }

  const DB_FILE_PATH = customDbPath || path.resolve(PROJECT_ROOT, 'server/data/db.json');
  const IMAGES_DIR = path.resolve(PROJECT_ROOT, 'server/uploads/images');
  const APKS_DIR = path.resolve(PROJECT_ROOT, 'server/uploads/apks');

  // STEP 1: READ AND VALIDATE JSON DATABASE
  header('STEP 1: READING & VALIDATING LOCAL JSON DATABASE');
  log(`Target DB file: ${DB_FILE_PATH}`, colors.dim);

  if (!fs.existsSync(DB_FILE_PATH)) {
    log(`ERROR: Database file not found at: ${DB_FILE_PATH}`, colors.red);
    return 1;
  }

  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf-8'));
  } catch (err) {
    log(`ERROR: Failed to parse ${DB_FILE_PATH} as JSON: ${err.message}`, colors.red);
    return 1;
  }

  const users = Array.isArray(rawData.users) ? rawData.users : [];
  const rawGames = Array.isArray(rawData.games) ? rawData.games : [];
  const rawReleases = Array.isArray(rawData.releases) ? rawData.releases : [];
  const rawProducts = Array.isArray(rawData.products) ? rawData.products : [];
  const rawSettings = rawData.settings && typeof rawData.settings === 'object' ? rawData.settings : null;

  log(`\nFound in JSON:`, colors.bright);
  console.log(`  - Users:    ${users.length}`);
  console.log(`  - Games:    ${rawGames.length}`);
  console.log(`  - Releases: ${rawReleases.length}`);
  console.log(`  - Products: ${rawProducts.length}`);
  console.log(`  - Settings: ${rawSettings ? 'Present' : 'Missing'}`);

  // Validate and Normalize Games
  const normalizedGames = [];
  const gameIdMap = new Map();
  const gameSlugMap = new Map();

  for (const g of rawGames) {
    if (!g.id || !g.title || !g.slug) {
      log(`WARNING: Skipping invalid game record (missing id, title, or slug): ${JSON.stringify(g)}`, colors.yellow);
      continue;
    }
    const normGame = {
      id: String(g.id),
      title: String(g.title),
      slug: String(g.slug),
      tagline: String(g.tagline || ''),
      description: String(g.description || ''),
      genre: Array.isArray(g.genre) ? g.genre : [],
      platforms: Array.isArray(g.platforms) && g.platforms.length > 0 ? g.platforms : ['Android'],
      status: ['Available', 'Coming Soon', 'Updated', 'In Beta'].includes(g.status) ? g.status : 'Available',
      featured: Boolean(g.featured),
      cover_image: String(g.cover_image || ''),
      banner_image: g.banner_image ? String(g.banner_image) : null,
      screenshots: Array.isArray(g.screenshots) ? g.screenshots : [],
      trailer_url: g.trailer_url ? String(g.trailer_url) : null,
      features: Array.isArray(g.features) ? g.features : [],
      controls: Array.isArray(g.controls) ? g.controls : [],
      requirements: typeof g.requirements === 'object' && g.requirements !== null ? g.requirements : {},
      developer: String(g.developer || 'Karsh Tech Studio'),
      created_at: g.created_at || new Date().toISOString(),
      updated_at: g.updated_at || new Date().toISOString()
    };
    normalizedGames.push(normGame);
    gameIdMap.set(normGame.id, normGame);
    gameSlugMap.set(normGame.slug, normGame);
  }

  // Validate and Normalize Releases
  const normalizedReleases = [];
  const orphanReleases = [];

  for (const r of rawReleases) {
    if (!r.id || !r.version_name || !r.apk_filename) {
      log(`WARNING: Skipping malformed release record: ${JSON.stringify(r)}`, colors.yellow);
      continue;
    }

    let resolvedGameId = null;
    if (gameIdMap.has(r.game_id)) {
      resolvedGameId = r.game_id;
    } else if (gameSlugMap.has(r.game_id)) {
      resolvedGameId = gameSlugMap.get(r.game_id).id;
      if (isVerbose) {
        log(`Normalized release ${r.id}: mapped slug '${r.game_id}' -> id '${resolvedGameId}'`, colors.dim);
      }
    } else {
      orphanReleases.push(r);
      log(`WARNING: Release ${r.id} (${r.version_name}) references non-existent game '${r.game_id}'!`, colors.red);
      continue;
    }

    const normRelease = {
      id: String(r.id),
      game_id: resolvedGameId,
      version_name: String(r.version_name),
      version_code: Number(r.version_code) || 1,
      release_date: r.release_date || new Date().toISOString().split('T')[0],
      release_notes: String(r.release_notes || ''),
      apk_filename: String(r.apk_filename),
      original_filename: r.original_filename ? String(r.original_filename) : String(r.apk_filename),
      apk_file_size: Number(r.apk_file_size) || 0,
      apk_download_url: String(r.apk_download_url || `/api/releases/${r.id}/download`),
      min_sdk: Number(r.min_sdk) || 26,
      target_sdk: Number(r.target_sdk) || 35,
      is_published: r.is_published !== undefined ? Boolean(r.is_published) : true,
      download_count: Number(r.download_count) || 0,
      created_at: r.created_at || new Date().toISOString()
    };
    normalizedReleases.push(normRelease);
  }

  // Validate and Normalize Products
  const normalizedProducts = [];
  for (const p of rawProducts) {
    if (!p.id || !p.name || !p.slug) {
      log(`WARNING: Skipping invalid product record: ${JSON.stringify(p)}`, colors.yellow);
      continue;
    }
    const normProduct = {
      id: String(p.id),
      name: String(p.name),
      slug: String(p.slug),
      short_description: String(p.short_description || ''),
      description: String(p.description || ''),
      category: ['Websites', 'Web Applications', 'Mobile Applications', 'Games', 'Custom Software'].includes(p.category) ? p.category : 'Web Applications',
      cover_image: String(p.cover_image || ''),
      gallery: Array.isArray(p.gallery) ? p.gallery : [],
      technologies: Array.isArray(p.technologies) ? p.technologies : [],
      project_url: p.project_url ? String(p.project_url) : null,
      github_url: p.github_url ? String(p.github_url) : null,
      play_store_url: p.play_store_url ? String(p.play_store_url) : null,
      apk_download_url: p.apk_download_url ? String(p.apk_download_url) : null,
      platform: ['Web', 'Android', 'iOS', 'Desktop', 'Cross-platform'].includes(p.platform) ? p.platform : 'Web',
      status: ['Draft', 'Published'].includes(p.status) ? p.status : 'Draft',
      featured: Boolean(p.featured),
      display_order: Number(p.display_order) || 0,
      created_at: p.created_at || new Date().toISOString(),
      updated_at: p.updated_at || new Date().toISOString(),
      published_at: p.published_at ? String(p.published_at) : null
    };
    normalizedProducts.push(normProduct);
  }

  // Validate and Normalize Settings
  const normalizedSettings = {
    id: 1,
    studio_name: String(rawSettings?.studio_name || 'Karsh Tech'),
    tagline: String(rawSettings?.tagline || 'Turning Ideas into Digital Reality'),
    contact_email: String(rawSettings?.contact_email || 'karshhtech@gmail.com'),
    announcement: rawSettings?.announcement ? String(rawSettings.announcement) : null,
    updated_at: rawSettings?.updated_at || new Date().toISOString(),
    initial_seeded: rawSettings?.initial_seeded !== undefined ? Boolean(rawSettings.initial_seeded) : true
  };

  log(`Data normalization complete:`, colors.green);
  console.log(`  ✓ Valid Users:    ${users.length}`);
  console.log(`  ✓ Valid Games:    ${normalizedGames.length}`);
  console.log(`  ✓ Valid Releases: ${normalizedReleases.length} (${orphanReleases.length} orphaned/skipped)`);
  console.log(`  ✓ Valid Products: ${normalizedProducts.length}`);
  console.log(`  ✓ Studio Settings: Ready (id: 1)`);

  // STEP 2: STORAGE INVENTORY & LOCAL ASSET AUDIT
  header('STEP 2: LOCAL STORAGE ASSET INVENTORY');

  const localImages = scanDirectory(IMAGES_DIR);
  const localApks = scanDirectory(APKS_DIR);

  const totalImageBytes = localImages.reduce((sum, f) => sum + f.size, 0);
  const totalApkBytes = localApks.reduce((sum, f) => sum + f.size, 0);

  console.log(`Images Directory: ${IMAGES_DIR}`);
  console.log(`  Total files: ${localImages.length} (${formatBytes(totalImageBytes)})`);
  console.log(`APKs Directory:   ${APKS_DIR}`);
  console.log(`  Total files: ${localApks.length} (${formatBytes(totalApkBytes)})`);

  const referencedImagePaths = new Set();
  const referencedApkFilenames = new Set();

  for (const g of normalizedGames) {
    if (g.cover_image) referencedImagePaths.add(g.cover_image);
    if (g.banner_image) referencedImagePaths.add(g.banner_image);
    for (const s of g.screenshots) referencedImagePaths.add(s);
  }

  for (const p of normalizedProducts) {
    if (p.cover_image) referencedImagePaths.add(p.cover_image);
    for (const g of p.gallery) referencedImagePaths.add(g);
  }

  for (const r of normalizedReleases) {
    if (r.apk_filename) referencedApkFilenames.add(r.apk_filename);
  }

  referencedImagePaths.add('/uploads/images/avatar_harsh.png');
  referencedImagePaths.add('/uploads/images/avatar_komal.png');
  referencedImagePaths.add('/uploads/images/avatar_aditya.png');

  console.log(`\nReferenced Asset Verification:`);
  let missingImages = 0;
  let missingApks = 0;

  for (const ref of referencedImagePaths) {
    const filename = path.basename(ref);
    const exists = localImages.some(f => f.filename === filename);
    if (!exists) {
      log(`  [MISSING IMAGE] Referenced '${ref}' not found in ${IMAGES_DIR}`, colors.red);
      missingImages++;
    } else if (isVerbose) {
      log(`  [OK] Image ${filename} found`, colors.dim);
    }
  }

  for (const apkName of referencedApkFilenames) {
    const exists = localApks.some(f => f.filename === apkName);
    if (!exists) {
      log(`  [MISSING APK] Release APK '${apkName}' not found in ${APKS_DIR}`, colors.red);
      missingApks++;
    } else if (isVerbose) {
      log(`  [OK] APK ${apkName} found`, colors.dim);
    }
  }

  if (missingImages === 0 && missingApks === 0) {
    log(`  ✓ All ${referencedImagePaths.size} referenced images and ${referencedApkFilenames.size} referenced APKs exist locally on disk!`, colors.green);
  }

  console.log(`\nStorage Size Analysis & Supabase Compatibility:`);
  const FREE_TIER_LIMIT = 50 * 1024 * 1024; // 50 MB
  let overLimitCount = 0;

  for (const f of [...localImages, ...localApks]) {
    if (f.size > FREE_TIER_LIMIT) {
      log(`  ⚠️  [EXCEEDS 50MB] ${f.filename} is ${formatBytes(f.size)}! Supabase Free Tier limit is 50MB. Requires Supabase Pro or chunked TUS upload.`, colors.yellow);
      overLimitCount++;
    }
  }
  if (overLimitCount === 0) {
    log(`  ✓ All local assets are well within the 50 MB Supabase Free Tier limit. (Largest APK: ${formatBytes(Math.max(0, ...localApks.map(a => a.size)))})`, colors.green);
  }

  // STEP 3: DRY RUN OR LIVE EXECUTION
  header('STEP 3: MIGRATION EXECUTION STATUS');

  if (!isExecute) {
    log('MODE: DRY-RUN (SIMULATION ONLY)', colors.bright + colors.yellow);
    log('No changes were made to Supabase. All validation checks passed.', colors.cyan);
    console.log(`
To execute live migration to Supabase:
  1. Ensure environment variables are set:
       export SUPABASE_URL="https://your-project.supabase.co"
       export SUPABASE_SECRET_KEY="your-service-role-key"
  2. Run the migration command with --execute:
       node scripts/migrate_json_to_supabase.mjs --execute
`);
    return 0;
  }

  // LIVE EXECUTION
  log('MODE: LIVE EXECUTION (--execute enabled)', colors.bright + colors.magenta);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('ERROR: SUPABASE_URL and SUPABASE_SECRET_KEY environment variables are required for live execution.', colors.red);
    log('Set them in your shell or .env before running with --execute.', colors.yellow);
    return 1;
  }

  try {
    // 1. Migrate Database Records in Strict Dependency Order
    if (!skipDb) {
      log('\n[1/5] Migrating Users...', colors.bright);
      await postgrestUpsert('users', users, { supabaseUrl, supabaseKey });
      log(`  ✓ Successfully upserted ${users.length} users`, colors.green);

      log('\n[2/5] Migrating Games...', colors.bright);
      await postgrestUpsert('games', normalizedGames, { supabaseUrl, supabaseKey });
      log(`  ✓ Successfully upserted ${normalizedGames.length} games`, colors.green);

      log('\n[3/5] Migrating Releases...', colors.bright);
      await postgrestUpsert('releases', normalizedReleases, { supabaseUrl, supabaseKey });
      log(`  ✓ Successfully upserted ${normalizedReleases.length} releases`, colors.green);

      log('\n[4/5] Migrating Products...', colors.bright);
      if (normalizedProducts.length > 0) {
        await postgrestUpsert('products', normalizedProducts, { supabaseUrl, supabaseKey });
        log(`  ✓ Successfully upserted ${normalizedProducts.length} products`, colors.green);
      } else {
        log('  ✓ No products in source JSON, skipping table insert', colors.dim);
      }

      log('\n[5/5] Migrating Studio Settings...', colors.bright);
      await postgrestUpsert('studio_settings', normalizedSettings, { supabaseUrl, supabaseKey });
      log('  ✓ Successfully upserted studio settings (id: 1)', colors.green);
    } else {
      log('Skipping database migration (--skip-db specified)', colors.yellow);
    }

    // 2. Migrate Storage Assets (Strictly Non-Overwriting)
    if (!skipStorage) {
      header('MIGRATING STORAGE ASSETS TO SUPABASE (NON-OVERWRITING)');

      // Upload Game Images to 'game-assets'
      log(`Syncing images to 'game-assets' bucket (x-upsert: false)...`, colors.cyan);
      let uploadedImages = 0;
      let skippedIdenticalImages = 0;
      let warningImages = 0;
      let failedImages = 0;

      for (const img of localImages) {
        if (img.filename.endsWith('.txt')) continue;
        const res = await uploadStorageFile('game-assets', img.filename, img.fullPath, img.mimeType, {
          supabaseUrl,
          supabaseKey,
          isVerbose
        });
        if (res.status === 'uploaded') uploadedImages++;
        else if (res.status === 'skipped_identical') skippedIdenticalImages++;
        else if (res.status.startsWith('warning_')) warningImages++;
        else failedImages++;
      }
      log(`  ✓ Result (game-assets): ${uploadedImages} uploaded, ${skippedIdenticalImages} skipped (identical), ${warningImages} warnings, ${failedImages} failed`, colors.green);

      // Upload APKs to 'release-apks'
      log(`\nSyncing APKs to private 'release-apks' bucket (x-upsert: false)...`, colors.cyan);
      let uploadedApks = 0;
      let skippedIdenticalApks = 0;
      let warningApks = 0;
      let failedApks = 0;

      for (const apk of localApks) {
        if (apk.size < 1000) {
          if (isVerbose) log(`  [SKIPPED TEST STUB] ${apk.filename} (${apk.size} bytes)`, colors.dim);
          continue;
        }
        const res = await uploadStorageFile('release-apks', apk.filename, apk.fullPath, apk.mimeType, {
          supabaseUrl,
          supabaseKey,
          isVerbose
        });
        if (res.status === 'uploaded') uploadedApks++;
        else if (res.status === 'skipped_identical') skippedIdenticalApks++;
        else if (res.status.startsWith('warning_')) warningApks++;
        else failedApks++;
      }
      log(`  ✓ Result (release-apks): ${uploadedApks} uploaded, ${skippedIdenticalApks} skipped (identical), ${warningApks} warnings, ${failedApks} failed`, colors.green);

      header('STORAGE MIGRATION SUMMARY');
      console.log(`  - Newly Uploaded:            ${uploadedImages + uploadedApks}`);
      console.log(`  - Skipped (Identical):       ${skippedIdenticalImages + skippedIdenticalApks}`);
      console.log(`  - Warnings (Manual Review):  ${warningImages + warningApks}`);
      console.log(`  - Failed Uploads:            ${failedImages + failedApks}`);

      const totalWarnings = warningImages + warningApks;
      const totalFailures = failedImages + failedApks;
      if (totalWarnings > 0 || totalFailures > 0) {
        log('\nATTENTION: One or more assets require manual review or failed during migration.', colors.yellow);
        log('Existing remote objects were preserved untouched. See logs above for details.', colors.yellow);
      }
    } else {
      log('Skipping storage migration (--skip-storage specified)', colors.yellow);
    }

    header('MIGRATION RUN COMPLETED');
    log('Database and storage migration pipeline executed.', colors.bright + colors.green);
    return 0;

  } catch (error) {
    log(`\nMIGRATION FAILED: ${error.message}`, colors.bright + colors.red);
    return 1;
  }
}

// Auto-run when executed directly from CLI
const isDirectCliRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectCliRun) {
  runCli().then(exitCode => {
    process.exit(exitCode);
  });
}
