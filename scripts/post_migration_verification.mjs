#!/usr/bin/env node

/**
 * ==============================================================================
 * KARSH TECH — PHASE 3 POST-MIGRATION INDEPENDENT VERIFICATION SCRIPT
 * File: scripts/post_migration_verification.mjs
 * 
 * Verifies live Supabase PostgreSQL tables and Storage buckets against
 * the local migration source and Phase 2.7 backup manifest.
 * NEVER prints or logs secret credentials or password hashes.
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Load .env safely
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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const headers = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json'
};

console.log('='.repeat(75));
console.log('  KARSH TECH — PHASE 3 POST-MIGRATION INDEPENDENT VERIFICATION');
console.log('='.repeat(75));
console.log(`Execution Timestamp: ${new Date().toISOString()}\n`);

let verificationPassed = true;

async function verifyAll() {
  // ----------------------------------------------------------------------------
  // 1. DATABASE VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('--- 1. DATABASE ENTITY VERIFICATION ---');

  // A. USERS
  const usersRes = await fetch(`${supabaseUrl}/rest/v1/users?select=*`, { headers });
  const users = await usersRes.json();
  console.log(`Users Table: ${users.length} row(s) [Expected: 1]`);
  if (users.length === 1) {
    const u = users[0];
    const localUser = JSON.parse(fs.readFileSync('server/data/db.json', 'utf8')).users[0];
    console.log(`  ✓ ID:            ${u.id} (Matches local: ${u.id === localUser.id})`);
    console.log(`  ✓ Username:      ${u.username} (Matches local: ${u.username === localUser.username})`);
    console.log(`  ✓ Role:          ${u.role} (Matches local: ${u.role === localUser.role})`);
    const hashMatch = u.password_hash === localUser.password_hash;
    const isBcrypt = typeof u.password_hash === 'string' && u.password_hash.startsWith('$2b$10$');
    console.log(`  ✓ Password Hash: Preserved exactly: ${hashMatch} (Format: Valid bcrypt $2b$, secret hidden)`);
    if (!hashMatch || !isBcrypt) verificationPassed = false;
  } else {
    console.error(`  ✗ Expected 1 user, found ${users.length}!`);
    verificationPassed = false;
  }

  // B. GAMES
  const gamesRes = await fetch(`${supabaseUrl}/rest/v1/games?select=*`, { headers });
  const games = await gamesRes.json();
  console.log(`\nGames Table: ${games.length} row(s) [Expected: 1]`);
  let migratedGame = null;
  if (games.length === 1) {
    const g = games[0];
    migratedGame = g;
    const localGame = JSON.parse(fs.readFileSync('server/data/db.json', 'utf8')).games[0];
    console.log(`  ✓ ID:            ${g.id} (Matches local: ${g.id === localGame.id})`);
    console.log(`  ✓ Title:         ${g.title}`);
    console.log(`  ✓ Slug:          ${g.slug}`);
    console.log(`  ✓ Status:        ${g.status}`);
    console.log(`  ✓ Featured:      ${g.featured}`);
    console.log(`  ✓ Screenshots:   ${g.screenshots.length} screenshots registered`);
    console.log(`  ✓ Requirements:  ${JSON.stringify(g.requirements)}`);
    if (g.id !== localGame.id || g.slug !== localGame.slug) verificationPassed = false;
  } else {
    console.error(`  ✗ Expected 1 game, found ${games.length}!`);
    verificationPassed = false;
  }

  // C. RELEASES
  const relsRes = await fetch(`${supabaseUrl}/rest/v1/releases?select=*`, { headers });
  const releases = await relsRes.json();
  console.log(`\nReleases Table: ${releases.length} row(s) [Expected: 1]`);
  if (releases.length === 1) {
    const r = releases[0];
    const localRel = JSON.parse(fs.readFileSync('server/data/db.json', 'utf8')).releases[0];
    console.log(`  ✓ ID:            ${r.id} (Matches local: ${r.id === localRel.id})`);
    console.log(`  ✓ Game ID:       ${r.game_id} (Matches migrated game: ${migratedGame && r.game_id === migratedGame.id})`);
    console.log(`  ✓ Version:       ${r.version_name} (Code: ${r.version_code})`);
    console.log(`  ✓ APK Filename:  ${r.apk_filename}`);
    console.log(`  ✓ Orig Filename: ${r.original_filename}`);
    console.log(`  ✓ File Size:     ${r.apk_file_size} bytes`);
    console.log(`  ✓ Download Count:${r.download_count} (Matches expected count 7: ${Number(r.download_count) === 7})`);
    if (r.id !== localRel.id || Number(r.download_count) !== 7) verificationPassed = false;
  } else {
    console.error(`  ✗ Expected 1 release, found ${releases.length}!`);
    verificationPassed = false;
  }

  // D. PRODUCTS
  const prodsRes = await fetch(`${supabaseUrl}/rest/v1/products?select=*`, { headers });
  const products = await prodsRes.json();
  console.log(`\nProducts Table: ${products.length} row(s) [Expected: 0]`);
  if (products.length === 0) {
    console.log('  ✓ Clean state: Zero product rows present (as expected).');
  } else {
    console.error(`  ✗ Expected 0 products, found ${products.length}!`);
    verificationPassed = false;
  }

  // E. STUDIO SETTINGS
  const settingsRes = await fetch(`${supabaseUrl}/rest/v1/studio_settings?select=*`, { headers });
  const settingsRows = await settingsRes.json();
  console.log(`\nStudio Settings: ${settingsRows.length} row(s) [Expected: 1]`);
  if (settingsRows.length === 1) {
    const s = settingsRows[0];
    console.log(`  ✓ ID:            ${s.id}`);
    console.log(`  ✓ Studio Name:   ${s.studio_name}`);
    console.log(`  ✓ Tagline:       ${s.tagline}`);
    console.log(`  ✓ Contact Email: ${s.contact_email}`);
    console.log(`  ✓ Initial Seeded:${s.initial_seeded}`);
    console.log(`  ✓ Updated At:    ${s.updated_at}`);
  } else {
    console.error(`  ✗ Expected 1 settings row, found ${settingsRows.length}!`);
    verificationPassed = false;
  }

  // ----------------------------------------------------------------------------
  // 2. STORAGE ASSETS VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. STORAGE ASSETS VERIFICATION ---');

  // List game-assets bucket
  const listGameRes = await fetch(`${supabaseUrl}/storage/v1/object/list/game-assets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prefix: '', limit: 100 })
  });
  const gameAssets = await listGameRes.json();
  console.log(`Bucket 'game-assets': ${gameAssets.length} object(s) [Expected: 9]`);

  const expectedGameAssets = [
    'arrow_puzzle_screenshot_1.jpg',
    'arrow_puzzle_screenshot_2.jpg',
    'arrow_puzzle_screenshot_3.jpg',
    'arrow_puzzle_screenshot_4.jpg',
    'arrow_puzzle_screenshot_5.jpg',
    'arrow_puzzle_screenshot_6.jpg',
    'avatar_aditya.png',
    'avatar_harsh.png',
    'avatar_komal.png'
  ];

  for (const exp of expectedGameAssets) {
    const found = gameAssets.find(a => a.name === exp);
    if (found) {
      const localFilePath = path.resolve(PROJECT_ROOT, 'server/uploads/images', exp);
      const localStat = fs.statSync(localFilePath);
      const sizeMatch = found.metadata?.size === localStat.size;
      console.log(`  ✓ [game-assets] ${exp} (${found.metadata?.size} B, Size Match: ${sizeMatch}, ETag: ${found.metadata?.eTag || 'present'})`);
      if (!sizeMatch) verificationPassed = false;
    } else {
      console.error(`  ✗ Missing expected asset in game-assets: ${exp}`);
      verificationPassed = false;
    }
  }

  // List release-apks bucket
  const listApkRes = await fetch(`${supabaseUrl}/storage/v1/object/list/release-apks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prefix: '', limit: 100 })
  });
  const apkAssets = await listApkRes.json();
  console.log(`\nBucket 'release-apks': ${apkAssets.length} object(s) [Expected: 1]`);

  const expectedApk = 'arrow-puzzle-release-v1.0.0.apk';
  const foundApk = apkAssets.find(a => a.name === expectedApk);
  if (foundApk) {
    const localApkPath = path.resolve(PROJECT_ROOT, 'server/uploads/apks', expectedApk);
    const localApkStat = fs.statSync(localApkPath);
    const sizeMatch = foundApk.metadata?.size === localApkStat.size;
    console.log(`  ✓ [release-apks] ${expectedApk} (${foundApk.metadata?.size} B, Size Match: ${sizeMatch})`);
    if (!sizeMatch) verificationPassed = false;
  } else {
    console.error(`  ✗ Missing expected APK in release-apks: ${expectedApk}`);
    verificationPassed = false;
  }

  // Check no test files in release-apks
  const testFilesFound = apkAssets.filter(a => a.name !== expectedApk);
  if (testFilesFound.length === 0) {
    console.log('  ✓ Clean APK bucket: Zero test stubs or unwanted files uploaded.');
  } else {
    console.error(`  ✗ Unwanted files found in release-apks: ${testFilesFound.map(t => t.name).join(', ')}`);
    verificationPassed = false;
  }

  // ----------------------------------------------------------------------------
  // 3. PUBLIC VS PRIVATE ACCESS VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. PUBLIC VS PRIVATE ACCESS VERIFICATION ---');

  // Public image probe (should return HTTP 200)
  const publicImageProbe = await fetch(`${supabaseUrl}/storage/v1/object/public/game-assets/arrow_puzzle_screenshot_1.jpg`);
  console.log(`Public image probe (game-assets/screenshot_1.jpg): HTTP ${publicImageProbe.status} [Expected: 200]`);
  if (publicImageProbe.status === 200) {
    console.log('  ✓ Public image access verified successfully.');
  } else {
    console.error(`  ✗ Public image probe failed with status ${publicImageProbe.status}!`);
    verificationPassed = false;
  }

  // Private APK probe (should be rejected/blocked)
  const privateApkProbe = await fetch(`${supabaseUrl}/storage/v1/object/public/release-apks/arrow-puzzle-release-v1.0.0.apk`);
  console.log(`Private APK probe (release-apks/arrow-puzzle...apk): HTTP ${privateApkProbe.status} [Expected: 400/404 Blocked]`);
  if (privateApkProbe.status === 400 || privateApkProbe.status === 404) {
    console.log('  ✓ Private APK access verified: Public access is strictly denied.');
  } else {
    console.error(`  ✗ Security breach: Private APK was accessible publicly with status ${privateApkProbe.status}!`);
    verificationPassed = false;
  }

  // ----------------------------------------------------------------------------
  // 4. INTEGRITY & BACKUP COMPARISON
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. INTEGRITY & LOCAL BACKUP VERIFICATION ---');

  const manifestPath = path.resolve(PROJECT_ROOT, 'backups/pre_supabase_migration_2026-10-31T18-18-14-467Z/manifest.sha256.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const dbHash = crypto.createHash('sha256').update(fs.readFileSync('server/data/db.json')).digest('hex');
  const dbMatch = dbHash === manifest.database.sha256;
  console.log(`Local db.json integrity check: ${dbMatch ? 'UNMODIFIED (100% Match)' : 'MODIFIED!'}`);

  let assetMatches = 0;
  for (const asset of manifest.assets) {
    const h = crypto.createHash('sha256').update(fs.readFileSync(asset.relPath)).digest('hex');
    if (h === asset.sha256) assetMatches++;
  }
  console.log(`Local asset files integrity check: ${assetMatches} of ${manifest.assets.length} UNMODIFIED`);

  if (!dbMatch || assetMatches !== manifest.assets.length) {
    verificationPassed = false;
  }

  console.log('\n' + '='.repeat(75));
  if (verificationPassed) {
    console.log('  PHASE 3 VERIFICATION COMPLETE: ALL INTEGRITY & MIGRATION CHECKS PASSED');
    console.log('='.repeat(75));
    process.exit(0);
  } else {
    console.log('  PHASE 3 VERIFICATION FAILED: DISCREPANCIES DETECTED');
    console.log('='.repeat(75));
    process.exit(1);
  }
}

verifyAll();
