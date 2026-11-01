#!/usr/bin/env node

/**
 * ==============================================================================
 * KARSH TECH — PHASE 2.7 MIGRATION SOURCE VERIFICATION & BACKUP SCRIPT
 * File: scripts/verify_and_backup.mjs
 * 
 * Verifies local data source integrity, computes SHA-256 hashes, generates
 * an asset manifest, and creates an immutable, timestamped pre-migration backup.
 * 
 * STRICTLY READ-ONLY with respect to original application files.
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DB_PATH = path.resolve(PROJECT_ROOT, 'server/data/db.json');
const IMAGES_DIR = path.resolve(PROJECT_ROOT, 'server/uploads/images');
const APKS_DIR = path.resolve(PROJECT_ROOT, 'server/uploads/apks');

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_DIR_NAME = `pre_supabase_migration_${TIMESTAMP}`;
const BACKUP_DIR = path.resolve(PROJECT_ROOT, 'backups', BACKUP_DIR_NAME);

function computeSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

console.log('='.repeat(75));
console.log('  KARSH TECH — PHASE 2.7 MIGRATION SOURCE VERIFICATION & BACKUP');
console.log('='.repeat(75));
console.log(`Execution Timestamp: ${new Date().toISOString()}`);
console.log(`Backup Destination:  ${BACKUP_DIR}\n`);

// ------------------------------------------------------------------------------
// 1. DATABASE SOURCE VERIFICATION
// ------------------------------------------------------------------------------
console.log('--- 1. DATABASE VERIFICATION (server/data/db.json) ---');

if (!fs.existsSync(DB_PATH)) {
  console.error(`ERROR: Database file missing at ${DB_PATH}`);
  process.exit(1);
}

const dbRaw = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const dbSha256 = computeSha256(DB_PATH);
const dbStat = fs.statSync(DB_PATH);

console.log(`db.json size:    ${formatBytes(dbStat.size)} (${dbStat.size} bytes)`);
console.log(`db.json SHA-256: ${dbSha256}`);

const users = dbRaw.users || [];
const games = dbRaw.games || [];
const releases = dbRaw.releases || [];
const products = dbRaw.products || [];
const settings = dbRaw.settings || {};

console.log(`\nEntity Counts:`);
console.log(`  - Users:    ${users.length}`);
console.log(`  - Games:    ${games.length}`);
console.log(`  - Releases: ${releases.length}`);
console.log(`  - Products: ${products.length}`);
console.log(`  - Settings: ${settings ? 'Present' : 'Missing'}`);

// Record IDs and duplicate checks
const userIds = users.map(u => u.id);
const usernames = users.map(u => u.username);
const gameIds = games.map(g => g.id);
const gameSlugs = games.map(g => g.slug);
const releaseIds = releases.map(r => r.id);
const productIds = products.map(p => p.id);
const productSlugs = products.map(p => p.slug);

function hasDuplicates(arr) {
  return new Set(arr).size !== arr.length;
}

console.log(`\nIntegrity & Duplicate Checks:`);
console.log(`  - Duplicate User IDs:      ${hasDuplicates(userIds) ? 'DETECTED!' : 'None (clean)'}`);
console.log(`  - Duplicate Usernames:     ${hasDuplicates(usernames) ? 'DETECTED!' : 'None (clean)'}`);
console.log(`  - Duplicate Game IDs:      ${hasDuplicates(gameIds) ? 'DETECTED!' : 'None (clean)'}`);
console.log(`  - Duplicate Game Slugs:    ${hasDuplicates(gameSlugs) ? 'DETECTED!' : 'None (clean)'}`);
console.log(`  - Duplicate Release IDs:   ${hasDuplicates(releaseIds) ? 'DETECTED!' : 'None (clean)'}`);
console.log(`  - Duplicate Product IDs:   ${hasDuplicates(productIds) ? 'DETECTED!' : 'None (clean)'}`);

// Release-to-Game Relationship
console.log(`\nRelease-to-Game Relationships:`);
let relationshipErrors = 0;
for (const rel of releases) {
  const targetGame = games.find(g => g.id === rel.game_id || g.slug === rel.game_id);
  if (targetGame) {
    console.log(`  ✓ Release '${rel.version_name}' (${rel.id}) -> Game '${targetGame.title}' (${targetGame.id}) [Match by ID: ${rel.game_id === targetGame.id}]`);
  } else {
    console.error(`  ✗ ORPHANED RELEASE: Release ${rel.id} points to non-existent game_id: ${rel.game_id}`);
    relationshipErrors++;
  }
}

// ------------------------------------------------------------------------------
// 2. ASSET INVENTORY & SHA-256 HASHING
// ------------------------------------------------------------------------------
console.log('\n--- 2. ASSET INVENTORY & SHA-256 HASH MANIFEST ---');

// Gather referenced files from database and frontend code
const referencedInDb = new Set();
for (const g of games) {
  if (g.cover_image) referencedInDb.add(path.basename(g.cover_image));
  if (g.banner_image) referencedInDb.add(path.basename(g.banner_image));
  for (const s of (g.screenshots || [])) referencedInDb.add(path.basename(s));
}
for (const p of products) {
  if (p.cover_image) referencedInDb.add(path.basename(p.cover_image));
  for (const g of (p.gallery || [])) referencedInDb.add(path.basename(g));
}
for (const r of releases) {
  if (r.apk_filename) referencedInDb.add(r.apk_filename);
}

// Frontend referenced avatars
const referencedInFrontend = new Set([
  'avatar_harsh.png',
  'avatar_komal.png',
  'avatar_aditya.png'
]);

function inspectFiles(dirPath, category) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.isFile()) {
      if (entry.name === '.gitkeep') continue;
      const fullPath = path.join(dirPath, entry.name);
      const stat = fs.statSync(fullPath);
      const sha256 = computeSha256(fullPath);
      const isRefDb = referencedInDb.has(entry.name);
      const isRefUi = referencedInFrontend.has(entry.name);
      const isReferenced = isRefDb || isRefUi;

      // Inclusion rule in migration script:
      // - Images: All real image files (.jpg, .png, .webp, .svg, .gif) included; .txt skipped
      // - APKs: APKs >= 1000 bytes included; dummy test stubs (< 1000 bytes) skipped
      let includedInMigration = false;
      let exclusionReason = null;

      if (category === 'images') {
        if (entry.name.endsWith('.txt')) {
          includedInMigration = false;
          exclusionReason = 'Non-image text file (test note)';
        } else {
          includedInMigration = true;
        }
      } else if (category === 'apks') {
        if (stat.size < 1000) {
          includedInMigration = false;
          exclusionReason = `Dummy test stub (${stat.size} bytes < 1KB threshold)`;
        } else {
          includedInMigration = true;
        }
      }

      results.push({
        category,
        filename: entry.name,
        relPath: path.join('server', 'uploads', category, entry.name).replace(/\\/g, '/'),
        fullPath,
        size: stat.size,
        sizeFormatted: formatBytes(stat.size),
        sha256,
        isReferencedDb: isRefDb,
        isReferencedUi: isRefUi,
        isReferenced,
        includedInMigration,
        exclusionReason
      });
    }
  }
  return results;
}

const imageManifest = inspectFiles(IMAGES_DIR, 'images');
const apkManifest = inspectFiles(APKS_DIR, 'apks');
const fullManifest = [...imageManifest, ...apkManifest];

console.log(`\nIMAGES INVENTORY (${imageManifest.length} files):`);
for (const item of imageManifest) {
  const status = item.includedInMigration ? 'INCLUDED' : 'EXCLUDED';
  const ref = item.isReferencedDb ? 'REF:DB' : item.isReferencedUi ? 'REF:UI' : 'UNREFERENCED';
  console.log(`  [${status}] [${ref}] ${item.filename} (${item.sizeFormatted})`);
  console.log(`    SHA-256: ${item.sha256}`);
  if (item.exclusionReason) console.log(`    Reason:  ${item.exclusionReason}`);
}

console.log(`\nAPKS INVENTORY (${apkManifest.length} files):`);
for (const item of apkManifest) {
  const status = item.includedInMigration ? 'INCLUDED' : 'EXCLUDED';
  const ref = item.isReferencedDb ? 'REF:DB' : 'UNREFERENCED';
  console.log(`  [${status}] [${ref}] ${item.filename} (${item.sizeFormatted})`);
  console.log(`    SHA-256: ${item.sha256}`);
  if (item.exclusionReason) console.log(`    Reason:  ${item.exclusionReason}`);
}

// ------------------------------------------------------------------------------
// 3. CROSS-REFERENCE VALIDATION
// ------------------------------------------------------------------------------
console.log('\n--- 3. CROSS-REFERENCE VALIDATION ---');

let missingAssets = 0;
for (const ref of referencedInDb) {
  const found = fullManifest.some(m => m.filename === ref);
  if (!found) {
    console.error(`  ✗ MISSING ASSET: Referenced in db.json but not found on disk: '${ref}'`);
    missingAssets++;
  }
}
for (const ref of referencedInFrontend) {
  const found = fullManifest.some(m => m.filename === ref);
  if (!found) {
    console.error(`  ✗ MISSING ASSET: Referenced in StudioPage.tsx but not found on disk: '${ref}'`);
    missingAssets++;
  }
}

if (missingAssets === 0 && relationshipErrors === 0) {
  console.log('  ✓ 100% Cross-Reference Validation PASSED.');
  console.log('  ✓ Every database record points to a valid file on disk.');
  console.log('  ✓ Every release maps to a valid game primary key.');
  console.log('  ✓ All UI team avatars are verified present on disk.');
}

// ------------------------------------------------------------------------------
// 4. CREATE INDEPENDENT PRE-MIGRATION BACKUP
// ------------------------------------------------------------------------------
console.log('\n--- 4. CREATING INDEPENDENT BACKUP ARCHIVE ---');

const backupDataDir = path.join(BACKUP_DIR, 'data');
const backupImagesDir = path.join(BACKUP_DIR, 'uploads', 'images');
const backupApksDir = path.join(BACKUP_DIR, 'uploads', 'apks');

fs.mkdirSync(backupDataDir, { recursive: true });
fs.mkdirSync(backupImagesDir, { recursive: true });
fs.mkdirSync(backupApksDir, { recursive: true });

// Copy db.json
const backupDbPath = path.join(backupDataDir, 'db.json');
fs.copyFileSync(DB_PATH, backupDbPath);
console.log(`  ✓ Backed up db.json -> ${backupDbPath}`);

// Copy Images
for (const img of imageManifest) {
  const dest = path.join(backupImagesDir, img.filename);
  fs.copyFileSync(img.fullPath, dest);
}
console.log(`  ✓ Backed up ${imageManifest.length} image files -> ${backupImagesDir}`);

// Copy APKs
for (const apk of apkManifest) {
  const dest = path.join(backupApksDir, apk.filename);
  fs.copyFileSync(apk.fullPath, dest);
}
console.log(`  ✓ Backed up ${apkManifest.length} APK files -> ${backupApksDir}`);

// Verify hashes of copied backup files
console.log('\nVerifying backup file integrity...');
let backupHashMismatches = 0;

if (computeSha256(backupDbPath) !== dbSha256) {
  console.error('  ✗ Hash mismatch on backed up db.json!');
  backupHashMismatches++;
}

for (const item of fullManifest) {
  const destPath = item.category === 'images'
    ? path.join(backupImagesDir, item.filename)
    : path.join(backupApksDir, item.filename);
  const destHash = computeSha256(destPath);
  if (destHash !== item.sha256) {
    console.error(`  ✗ Hash mismatch on backed up file: ${item.filename}`);
    backupHashMismatches++;
  }
}

if (backupHashMismatches === 0) {
  console.log(`  ✓ All ${fullManifest.length + 1} backup files verified with 100% SHA-256 match!`);
} else {
  console.error(`  ✗ Backup integrity check failed with ${backupHashMismatches} mismatches!`);
  process.exit(1);
}

// Generate Manifest JSON & Text
const manifestData = {
  timestamp: new Date().toISOString(),
  backupDirectory: BACKUP_DIR,
  database: {
    path: 'server/data/db.json',
    size: dbStat.size,
    sha256: dbSha256,
    counts: {
      users: users.length,
      games: games.length,
      releases: releases.length,
      products: products.length
    }
  },
  assets: fullManifest.map(m => ({
    relPath: m.relPath,
    filename: m.filename,
    category: m.category,
    size: m.size,
    sha256: m.sha256,
    isReferenced: m.isReferenced,
    includedInMigration: m.includedInMigration,
    exclusionReason: m.exclusionReason
  }))
};

const manifestJsonPath = path.join(BACKUP_DIR, 'manifest.sha256.json');
fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestData, null, 2), 'utf-8');

const manifestTxtLines = [
  `# Karsh Tech SHA-256 Asset Manifest — Pre-Supabase Migration Freeze`,
  `# Generated: ${new Date().toISOString()}`,
  `# Total Assets: ${fullManifest.length + 1}`,
  ``,
  `${dbSha256}  server/data/db.json`,
  ...fullManifest.map(m => `${m.sha256}  ${m.relPath}`)
];
const manifestTxtPath = path.join(BACKUP_DIR, 'manifest.sha256.txt');
fs.writeFileSync(manifestTxtPath, manifestTxtLines.join('\n') + '\n', 'utf-8');

console.log(`  ✓ Generated manifest JSON: ${manifestJsonPath}`);
console.log(`  ✓ Generated manifest TXT:  ${manifestTxtPath}`);

console.log('\n' + '='.repeat(75));
console.log('  PHASE 2.7 VERIFICATION AND BACKUP COMPLETE');
console.log('='.repeat(75));
