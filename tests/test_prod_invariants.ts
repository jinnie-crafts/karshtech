import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { createStorageService } from '../server/storage/index.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch {}
}

const { Pool } = pg;

interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function run(num: number, category: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ [PASS] [${category}] ${name}`);
    reports.push({ num, name, category, passed: true });
  } catch (err: any) {
    console.error(`  ✗ [FAIL] [${category}] ${name}: ${err.message}`);
    reports.push({ num, name, category, passed: false, error: err.message });
  }
}

export async function runProductionSafetyChecks(): Promise<TestReport[]> {
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.2 PRODUCTION READ-ONLY INVARIANT CHECKS');
  console.log('================================================================\n');

  const prodUrl = process.env.DATABASE_URL;
  if (!prodUrl) {
    throw new Error('DATABASE_URL must be configured in .env for production safety checks');
  }

  const prodPool = new Pool({
    connectionString: prodUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  const storage = createStorageService();
  await storage.init();

  try {
    // ------------------------------------------------------------------------
    // PRODUCTION DATABASE INVARIANTS
    // ------------------------------------------------------------------------
    console.log('--- 1. Production Supabase PostgreSQL Invariants ---');

    await run(1, 'ProdDB', 'Arrow Puzzle release download_count is strictly 7', async () => {
      const res = await prodPool.query(`
        SELECT id, download_count, apk_filename
        FROM releases
        WHERE apk_filename = 'arrow-puzzle-release-v1.0.0.apk';
      `);
      assert(res.rows.length === 1, 'Arrow puzzle release not found in production Supabase');
      const count = Number(res.rows[0].download_count);
      assert(count === 7, `Production download_count invariant violated! Expected 7, got ${count}`);
    });

    await run(2, 'ProdDB', 'Studio settings contact email is karshhtech@gmail.com', async () => {
      const res = await prodPool.query(`SELECT contact_email, studio_name FROM studio_settings WHERE id = 1;`);
      assert(res.rows.length === 1, 'Settings row not found');
      assert(res.rows[0].contact_email === 'karshhtech@gmail.com', 'Production contact email mismatch');
      assert(res.rows[0].studio_name === 'Karsh Tech', 'Production studio name mismatch');
    });

    // ------------------------------------------------------------------------
    // PRODUCTION STORAGE INVARIANTS
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Production Supabase Storage Invariants ---');

    await run(3, 'ProdStorage', 'Production APK arrow-puzzle-release-v1.0.0.apk exists and is 2,885,749 bytes', async () => {
      const meta = await storage.getObjectMetadata('release-apks', 'arrow-puzzle-release-v1.0.0.apk');
      assert(meta !== null, 'Production APK does not exist in release-apks bucket');
      assert(meta!.size === 2885749, `APK size mismatch! Expected 2885749, got ${meta!.size}`);
    });

    await run(4, 'ProdStorage', 'All 9 production images verified intact in game-assets', async () => {
      const expectedImages = [
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

      for (const img of expectedImages) {
        const meta = await storage.getObjectMetadata('game-assets', img);
        assert(meta !== null, `Production image missing: ${img}`);
      }
    });

    // ------------------------------------------------------------------------
    // LOCAL AUTHORITATIVE DATA INTEGRITY
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Local Authoritative db.json Integrity ---');

    await run(5, 'LocalData', 'server/data/db.json SHA-256 matches Phase 2.7 manifest exactly', async () => {
      const dbPath = path.resolve(process.cwd(), 'server/data/db.json');
      const hash = crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');
      const expectedHash = '848467c6c02fdae3c7da1536c5bf1a01e16eeb55f85e4888486f2525829c44b7';
      assert(hash === expectedHash, `Local db.json hash mismatch! Expected ${expectedHash}, got ${hash}`);
    });

  } finally {
    await prodPool.end();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`PRODUCTION SAFETY CHECKS: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Production Safety Checks`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_prod_invariants.ts')) {
  runProductionSafetyChecks().catch(err => {
    console.error('[FATAL ERROR IN PRODUCTION SAFETY CHECKS]', err);
    process.exit(1);
  });
}
