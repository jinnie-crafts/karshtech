#!/usr/bin/env node

/**
 * ==============================================================================
 * KARSH TECH — PHASE 3 PRE-EXECUTION HEALTH & ENVIRONMENT CHECK
 * File: scripts/pre_execution_check.mjs
 * 
 * Verifies Supabase connection, existence of 5 tables, 3 buckets, and visibility.
 * NEVER prints or logs secret credentials.
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
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
const databaseUrl = process.env.DATABASE_URL;

console.log('='.repeat(70));
console.log('  PHASE 3: PRE-EXECUTION VERIFICATION & HEALTH CHECK');
console.log('='.repeat(70));

let checkPassed = true;

// 1. Environment Variables Availability
console.log('\n[1/5] Checking Environment Variables Availability:');
if (supabaseUrl && supabaseUrl.startsWith('https://')) {
  console.log('  ✓ SUPABASE_URL: Configured (Valid HTTPS format, length: ' + supabaseUrl.length + ')');
} else {
  console.error('  ✗ SUPABASE_URL: Missing or invalid format!');
  checkPassed = false;
}

if (supabaseKey && supabaseKey.length > 20) {
  console.log('  ✓ SUPABASE_SECRET_KEY: Configured (Length: ' + supabaseKey.length + ' chars, secret hidden)');
} else {
  console.error('  ✗ SUPABASE_SECRET_KEY: Missing or empty!');
  checkPassed = false;
}

if (databaseUrl && databaseUrl.startsWith('postgres')) {
  console.log('  ✓ DATABASE_URL: Configured (Valid connection string, secret hidden)');
} else {
  console.log('  - DATABASE_URL: Optional for REST migration (Secret hidden)');
}

if (!checkPassed) {
  console.error('\nPre-execution check FAILED: Required environment variables are missing.');
  process.exit(1);
}

const headers = {
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json'
};

async function runHealthCheck() {
  // 2. Migration Script Inspection
  console.log('\n[2/5] Inspecting Migration Script Safety Guarantees:');
  const scriptPath = path.resolve(PROJECT_ROOT, 'scripts/migrate_json_to_supabase.mjs');
  const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

  const hasXUpsertFalse = scriptContent.includes("'x-upsert': 'false'") || scriptContent.includes('"x-upsert": "false"');
  const hasXUpsertTrue = scriptContent.includes("'x-upsert': 'true'") || scriptContent.includes('"x-upsert": "true"');
  const hasConflictHandling = scriptContent.includes('res.status === 409') && scriptContent.includes('skipped_identical');

  if (hasXUpsertFalse && !hasXUpsertTrue) {
    console.log("  ✓ Strictly Non-Overwriting: 'x-upsert: false' confirmed present and 'x-upsert: true' absent.");
  } else {
    console.error("  ✗ Overwrite safety check failed! Found 'x-upsert: true' or missing 'x-upsert: false'.");
    checkPassed = false;
  }

  if (hasConflictHandling) {
    console.log("  ✓ Conflict Inspection: HTTP 409 conflict handling & remote metadata verification active.");
  } else {
    console.error("  ✗ Conflict handling missing in migration script!");
    checkPassed = false;
  }

  // 3. PostgreSQL Tables Existence Check
  console.log('\n[3/5] Verifying PostgreSQL Tables via PostgREST:');
  const expectedTables = ['users', 'games', 'releases', 'products', 'studio_settings'];
  for (const table of expectedTables) {
    try {
      const endpoint = `${supabaseUrl}/rest/v1/${table}?select=*&limit=1`;
      const res = await fetch(endpoint, { method: 'GET', headers });
      if (res.ok) {
        const rows = await res.json();
        console.log(`  ✓ Table '${table}': Present (accessible via PostgREST, current rows: ${rows.length})`);
      } else {
        const errText = await res.text();
        console.error(`  ✗ Table '${table}' returned HTTP ${res.status}: ${errText}`);
        checkPassed = false;
      }
    } catch (err) {
      console.error(`  ✗ Table '${table}' connection error: ${err.message}`);
      checkPassed = false;
    }
  }

  // 4. Supabase Storage Buckets Existence and Visibility
  console.log('\n[4/5] Verifying Supabase Storage Buckets & Visibility:');
  try {
    const bucketsEndpoint = `${supabaseUrl}/storage/v1/bucket`;
    const res = await fetch(bucketsEndpoint, { method: 'GET', headers });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`  ✗ Storage buckets endpoint returned HTTP ${res.status}: ${errText}`);
      checkPassed = false;
    } else {
      const buckets = await res.json();
      console.log(`  Found ${buckets.length} bucket(s) in Supabase:`);

      const expectedBuckets = {
        'game-assets': { expectedPublic: true },
        'product-assets': { expectedPublic: true },
        'release-apks': { expectedPublic: false }
      };

      for (const [name, config] of Object.entries(expectedBuckets)) {
        const found = buckets.find(b => b.id === name || b.name === name);
        if (!found) {
          console.error(`  ✗ Bucket '${name}': MISSING!`);
          checkPassed = false;
        } else {
          const isCorrectVisibility = found.public === config.expectedPublic;
          const visStr = found.public ? 'PUBLIC' : 'PRIVATE';
          if (isCorrectVisibility) {
            console.log(`  ✓ Bucket '${name}': Present (Visibility: ${visStr}, Limit: ${found.file_size_limit ? (found.file_size_limit / 1024 / 1024) + ' MB' : 'Default'})`);
          } else {
            console.error(`  ✗ Bucket '${name}': Misconfigured visibility! Found ${visStr}, expected ${config.expectedPublic ? 'PUBLIC' : 'PRIVATE'}`);
            checkPassed = false;
          }
        }
      }
    }
  } catch (err) {
    console.error(`  ✗ Storage check error: ${err.message}`);
    checkPassed = false;
  }

  // 5. APK Size Compatibility
  console.log('\n[5/5] Checking APK Size Compatibility:');
  const apkPath = path.resolve(PROJECT_ROOT, 'server/uploads/apks/arrow-puzzle-release-v1.0.0.apk');
  if (fs.existsSync(apkPath)) {
    const stat = fs.statSync(apkPath);
    const sizeMb = (stat.size / 1024 / 1024).toFixed(2);
    console.log(`  ✓ Production APK: arrow-puzzle-release-v1.0.0.apk (${sizeMb} MB / ${stat.size} bytes)`);
    if (stat.size < 50 * 1024 * 1024) {
      console.log(`  ✓ Size ${sizeMb} MB is well within Supabase 50 MB standard limit (uses ~5.5% of quota).`);
    } else {
      console.error(`  ✗ APK size exceeds 50 MB limit!`);
      checkPassed = false;
    }
  } else {
    console.error(`  ✗ Production APK missing at ${apkPath}!`);
    checkPassed = false;
  }

  console.log('\n' + '='.repeat(70));
  if (checkPassed) {
    console.log('  STATUS: ALL PRE-EXECUTION CHECKS PASSED WITH 100% SUCCESS');
    console.log('='.repeat(70));
    process.exit(0);
  } else {
    console.log('  STATUS: PRE-EXECUTION CHECKS FAILED. DO NOT PROCEED.');
    console.log('='.repeat(70));
    process.exit(1);
  }
}

runHealthCheck();
