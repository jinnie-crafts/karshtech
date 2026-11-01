import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { SupabaseStorageService } from '../server/storage/SupabaseStorageService.js';
import { DB_FILE } from '../server/paths.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

const { Pool } = pg;

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runStorageProdReadonlyTests(): Promise<TestReport[]> {
  const reports: TestReport[] = [];
  let testNum = 0;

  async function run(category: string, name: string, fn: () => Promise<void>) {
    testNum++;
    try {
      await fn();
      reports.push({ num: testNum, name, category, passed: true });
      console.log(`  ✓ [PASS] [${category}] ${name}`);
    } catch (err: any) {
      reports.push({ num: testNum, name, category, passed: false, error: err.message });
      console.error(`  ✗ [FAIL] [${category}] ${name}: ${err.message}`);
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.3 PRODUCTION READ-ONLY STORAGE VERIFICATION');
  console.log('================================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const prodDbUrl = process.env.DATABASE_URL;

  assert(Boolean(supabaseUrl && serviceKey), 'Production Supabase credentials must be configured for read-only verification');
  const storage = new SupabaseStorageService(supabaseUrl, serviceKey);
  await storage.init();

  // --- 1. Public game-assets Bucket Verification ---
  console.log('--- 1. Public game-assets Bucket Invariants ---');

  const EXPECTED_IMAGES = [
    'arrow_puzzle_screenshot_1.jpg',
    'arrow_puzzle_screenshot_2.jpg',
    'arrow_puzzle_screenshot_3.jpg',
    'arrow_puzzle_screenshot_4.jpg',
    'arrow_puzzle_screenshot_5.jpg',
    'arrow_puzzle_screenshot_6.jpg',
    'avatar_aditya.png',
    'avatar_harsh.png',
    'avatar_komal.png',
  ];

  await run('ProdStorage', 'All 9 production images verified present in public game-assets bucket', async () => {
    for (const imgName of EXPECTED_IMAGES) {
      const meta = await storage.getObjectMetadata('game-assets', imgName);
      assert(meta !== null, `Production image "${imgName}" missing in game-assets`);
      assert(meta.size > 0, `Production image "${imgName}" has zero size`);
    }
  });

  await run('ProdStorage', 'Public CDN URLs return HTTP 200 for all 9 game-assets images', async () => {
    for (const imgName of EXPECTED_IMAGES) {
      const publicUrl = storage.getPublicUrl('game-assets', imgName);
      const res = await fetch(publicUrl, { method: 'HEAD' });
      assert(res.status === 200, `Public CDN fetch for "${imgName}" returned HTTP ${res.status}`);
    }
  });

  // --- 2. Private release-apks Bucket Verification ---
  console.log('\n--- 2. Private release-apks Bucket Invariants ---');

  const EXPECTED_APK = 'arrow-puzzle-release-v1.0.0.apk';
  const EXPECTED_APK_SIZE = 2885749;

  await run('ProdStorage', `Production APK exists and is exactly ${EXPECTED_APK_SIZE} bytes`, async () => {
    const apkMeta = await storage.getObjectMetadata('release-apks', EXPECTED_APK);
    assert(apkMeta !== null, `Production APK "${EXPECTED_APK}" missing in release-apks`);
    assert(apkMeta.size === EXPECTED_APK_SIZE, `APK size mismatch (expected: ${EXPECTED_APK_SIZE}, actual: ${apkMeta.size})`);
  });

  await run('ProdStorage', 'Direct public unauthenticated URL access to release-apks is strictly BLOCKED', async () => {
    const cleanUrl = supabaseUrl?.replace(/\/+$/, '');
    const publicApkAttemptUrl = `${cleanUrl}/storage/v1/object/public/release-apks/${EXPECTED_APK}`;

    const res = await fetch(publicApkAttemptUrl, { method: 'GET' });
    // Supabase returns 400 or 403 or 404 for public requests to a private bucket
    const isBlocked = res.status === 400 || res.status === 403 || res.status === 404;
    assert(isBlocked, `Public access to private APK was NOT blocked (HTTP ${res.status})`);
  });

  // --- 3. Production Supabase PostgreSQL Invariants ---
  console.log('\n--- 3. Production PostgreSQL Invariants ---');

  if (prodDbUrl) {
    const prodPool = new Pool({
      connectionString: prodDbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });

    try {
      await run('ProdDB', 'Production Arrow Puzzle download_count remains strictly 7', async () => {
        const res = await prodPool.query(`
          SELECT r.download_count, r.version_name, g.title
          FROM releases r
          JOIN games g ON r.game_id = g.id
          WHERE g.slug = 'arrow-puzzle'
          ORDER BY r.created_at DESC
          LIMIT 1;
        `);
        assert(res.rows.length > 0, 'Arrow puzzle release found in production DB');
        const count = parseInt(String(res.rows[0].download_count), 10);
        assert(count === 7, `Production download_count MUST remain strictly 7 (actual: ${count})`);
      });

      await run('ProdDB', 'Production Studio Settings contact email remains karshhtech@gmail.com', async () => {
        const res = await prodPool.query(`SELECT contact_email FROM studio_settings WHERE id = 1;`);
        assert(res.rows.length > 0, 'Production settings found');
        assert(res.rows[0].contact_email === 'karshhtech@gmail.com', 'Contact email matches');
      });
    } finally {
      await prodPool.end();
    }
  }

  // --- 4. Local Authoritative db.json Integrity ---
  console.log('\n--- 4. Local Authoritative db.json Integrity ---');

  const EXPECTED_JSON_HASH = '848467c6c02fdae3c7da1536c5bf1a01e16eeb55f85e4888486f2525829c44b7';

  await run('LocalData', 'server/data/db.json SHA-256 matches Phase 2.7 manifest exactly', async () => {
    assert(fs.existsSync(DB_FILE), `db.json exists at ${DB_FILE}`);
    const content = fs.readFileSync(DB_FILE);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    assert(hash === EXPECTED_JSON_HASH, `Hash mismatch (expected: ${EXPECTED_JSON_HASH}, actual: ${hash})`);
  });

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`PRODUCTION READ-ONLY SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Production Read-Only Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_storage_prod_readonly.ts')) {
  runStorageProdReadonlyTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN PROD READONLY SUITE]', err);
      process.exit(1);
    });
}
