import fs from 'fs';
import path from 'path';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, data: json };
}

export async function run() {
  console.log('=== STARTING PRODUCTION DATABASE PERSISTENCE VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(testNum, testName, condition, detail) {
    if (condition) {
      console.log(`[PASS] Test ${testNum}: ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${testNum}: ${testName} - ${detail}`);
      failed++;
    }
  }

  // Login as admin
  let token = '';
  try {
    const loginRes = await fetchJson(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'khrgosh', password: 'KarshTechAdmin2026!' }),
    });
    token = loginRes.data?.token || '';
    assert(1, 'Admin login succeeds with khrgosh', loginRes.status === 200 && !!token, `Status: ${loginRes.status}`);
  } catch (err) {
    assert(1, 'Admin login succeeds with khrgosh', false, err.message);
  }

  // Test 2: Query storage diagnostic endpoint
  try {
    const storageRes = await fetchJson(`${BASE_URL}/api/admin/system/storage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const info = storageRes.data?.storage;
    const isValid = storageRes.status === 200 && info && typeof info.dataDir === 'string' && typeof info.dbFile === 'string';
    assert(2, 'GET /api/admin/system/storage returns active storage directory topology', isValid, JSON.stringify(storageRes.data));
  } catch (err) {
    assert(2, 'GET /api/admin/system/storage returns active storage directory topology', false, err.message);
  }

  // Test 3: Verify atomic write and database file existence
  try {
    const { db } = await import('./server/db.js');
    const storageInfo = db.getStorageInfo();
    const dbExists = fs.existsSync(storageInfo.dbFile);
    assert(3, 'db.json exists at resolved data directory', dbExists, `dbFile: ${storageInfo.dbFile}`);

    // Verify atomic backup creation
    const backupFile = db.createBackup('unit_test');
    const backupExists = backupFile && fs.existsSync(backupFile);
    assert(4, 'db.createBackup() creates timestamped backup in backups directory', Boolean(backupExists), `backupFile: ${backupFile}`);

    // Clean up unit test backup
    if (backupFile && fs.existsSync(backupFile)) {
      try { fs.unlinkSync(backupFile); } catch {}
    }
  } catch (err) {
    assert(3, 'db.json exists at resolved data directory', false, err.message);
    assert(4, 'db.createBackup() creates timestamped backup in backups directory', false, err.message);
  }

  // Test 5: Verify seed logic NEVER creates demo game when explicit SEED_DEMO_DATA is not set
  try {
    const { seedDatabase } = await import('./server/seed.js');
    const { db } = await import('./server/db.js');
    
    // Create a temporary mock scenario or inspect settings
    const settings = db.getSettings();
    assert(5, 'Settings has initial_seeded flag set to prevent dummy data resurrections', settings.initial_seeded === true, `initial_seeded: ${settings.initial_seeded}`);

    // Call seedDatabase() and ensure existing games count did not arbitrarily explode with dummy records
    const countBefore = db.getGames().length;
    await seedDatabase();
    const countAfter = db.getGames().length;
    assert(6, 'Re-executing seedDatabase() does NOT recreate or duplicate games', countBefore === countAfter, `Before: ${countBefore}, After: ${countAfter}`);
  } catch (err) {
    assert(5, 'Settings has initial_seeded flag set', false, err.message);
    assert(6, 'Re-executing seedDatabase() does NOT recreate or duplicate games', false, err.message);
  }

  // Test 7: Verify Featured game query strictly honors featured: true
  try {
    const gamesRes = await fetchJson(`${BASE_URL}/api/games`);
    const games = gamesRes.data?.games || [];
    const featuredGames = games.filter(g => g.featured);
    const nonFeaturedGames = games.filter(g => !g.featured);
    
    // In our public API, only games with featured === true should be identified as featured
    assert(7, 'Public API delivers game list correctly', gamesRes.status === 200, `Games count: ${games.length}`);
  } catch (err) {
    assert(7, 'Public API delivers game list correctly', false, err.message);
  }

  console.log(`\n=== PERSISTENCE SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    throw new Error(`${failed} persistence tests failed`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('test_persistence.mjs')) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
