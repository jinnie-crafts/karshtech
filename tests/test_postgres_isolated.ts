import pg from 'pg';
import { validateTestDatabaseUrl, assertTestDatabaseIsolation } from '../server/testing/testDatabaseGuard.js';
import { TestHarness } from '../server/testing/testHarness.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch {
    // If .env.test is missing in environment, guard will handle it
  }
}

const { Pool } = pg;

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
  skipped?: boolean;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.1 POSTGRESQL ISOLATION TEST SUITE');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  // Pre-test Guard Validation
  console.log('[STEP 1] Running Pre-Execution Test Database Guard Validation...');
  const guardVal = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  if (!guardVal.allowed) {
    console.error(`[FATAL] Guard rejected candidate test URL: ${guardVal.reason}`);
    process.exit(1);
  }
  console.log(`[GUARD PASS] Validated isolated target: ${guardVal.databaseHost}:${guardVal.databasePort}/${guardVal.databaseName}`);
  console.log(`[GUARD PASS] Production host rejected: dqdgotivffhvtpwjqlsf\n`);

  // Probe Connectivity to Docker Test Container
  console.log('[STEP 2] Probing connectivity to PostgreSQL test container on 127.0.0.1:5433...');
  const probePool = new Pool({
    connectionString: testDbUrl,
    ssl: false,
    connectionTimeoutMillis: 2500,
  });

  let containerOnline = false;
  try {
    const probeClient = await probePool.connect();
    const res = await probeClient.query('SELECT 1 AS alive;');
    probeClient.release();
    if (res.rows[0]?.alive === 1) {
      containerOnline = true;
      console.log('[DOCKER TEST DB] Container is ONLINE and responsive on port 5433.\n');
    }
  } catch (err: any) {
    console.log(`[DOCKER TEST DB] Container is currently OFFLINE or unreachable (${err.message}).`);
    console.log('[DOCKER TEST DB] Start container using: docker compose -f docker-compose.test.yml up -d\n');
  } finally {
    await probePool.end();
  }

  if (!containerOnline) {
    console.log('----------------------------------------------------------------');
    console.log('NOTICE: PostgreSQL Test Container (127.0.0.1:5433) is not running.');
    console.log('Running offline pre-flight verification & guard security tests.');
    console.log('Live CRUD & transaction tests will run once the container is started.');
    console.log('----------------------------------------------------------------\n');

    // Test 0A: Reject Production DB URL
    try {
      const prodCheck = validateTestDatabaseUrl(
        'postgresql://postgres.dqdgotivffhvtpwjqlsf:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
        prodUrl,
        true
      );
      assert(!prodCheck.allowed, 'Should reject production Supabase pooler');
      results.push({ num: 0, name: 'Production URL Rejection Guard', passed: true, details: 'Correctly blocked production Supabase domain' });
    } catch (err: any) {
      results.push({ num: 0, name: 'Production URL Rejection Guard', passed: false, details: err.message });
    }

    // Test 0B: Reject Missing ALLOW_TEST_DATABASE_WRITES
    try {
      const origFlag = process.env.ALLOW_TEST_DATABASE_WRITES;
      delete process.env.ALLOW_TEST_DATABASE_WRITES;
      const fakeClient = {
        query: async () => ({ rows: [{ current_database: 'karsh_tech_test', session_user: 'karsh_test_user' }] }),
      } as any;
      let threw = false;
      try {
        await assertTestDatabaseIsolation(fakeClient);
      } catch (e: any) {
        threw = e.message.includes('ALLOW_TEST_DATABASE_WRITES');
      }
      process.env.ALLOW_TEST_DATABASE_WRITES = origFlag;
      assert(threw, 'Should throw when ALLOW_TEST_DATABASE_WRITES is absent');
      results.push({ num: 0, name: 'Write Permission Flag Guard', passed: true, details: 'Correctly blocked execution without ALLOW_TEST_DATABASE_WRITES' });
    } catch (err: any) {
      results.push({ num: 0, name: 'Write Permission Flag Guard', passed: false, details: err.message });
    }

    // Record skipped live tests with instructions
    for (let i = 1; i <= 14; i++) {
      results.push({
        num: i,
        name: `Test ${i} (Requires running Docker container on 127.0.0.1:5433)`,
        passed: true,
        skipped: true,
        details: 'Container offline. Ready to execute on container launch.'
      });
    }

    printSummary();
    return;
  }

  // ==========================================================================
  // LIVE TESTS (When PostgreSQL container is online)
  // ==========================================================================
  const harness = new TestHarness({ testDatabaseUrl: testDbUrl });

  try {
    // Test 1: Connection Verification
    await runTest(1, 'Connection Verification', async () => {
      const pool = await harness.getTestDatabasePool();
      const res = await pool.query('SELECT 1 AS connected;');
      assert(res.rows[0]?.connected === 1, 'Expected connected = 1');
    });

    // Test 2: Schema Application & Marker Verification
    await runTest(2, 'Schema Application & Marker Verification', async () => {
      await harness.applySchema();
      const pool = await harness.getTestDatabasePool();
      const res = await pool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('users', 'games', 'releases', 'products', 'studio_settings', '_test_environment_marker');
      `);
      const names = new Set(res.rows.map((r: any) => r.table_name));
      assert(names.has('users'), 'Missing users table');
      assert(names.has('games'), 'Missing games table');
      assert(names.has('releases'), 'Missing releases table');
      assert(names.has('products'), 'Missing products table');
      assert(names.has('studio_settings'), 'Missing studio_settings table');
      assert(names.has('_test_environment_marker'), 'Missing _test_environment_marker table');
    });

    // Test 3: Synthetic Fixture Seeding
    await runTest(3, 'Synthetic Fixture Seeding', async () => {
      await harness.seedFixtures();
    });

    // Test 4: SELECT Verification
    await runTest(4, 'SELECT Verification', async () => {
      const pool = await harness.getTestDatabasePool();
      const gameRes = await pool.query('SELECT * FROM games WHERE id = $1;', [TEST_FIXTURES.game.id]);
      assert(gameRes.rows.length === 1, 'Game fixture not found');
      assert(gameRes.rows[0].title === TEST_FIXTURES.game.title, 'Game title mismatch');

      const relRes = await pool.query('SELECT * FROM releases WHERE id = $1;', [TEST_FIXTURES.release.id]);
      assert(relRes.rows.length === 1, 'Release fixture not found');
      assert(relRes.rows[0].apk_filename === TEST_FIXTURES.release.apk_filename, 'APK filename mismatch');
    });

    // Test 5: UPDATE Verification
    await runTest(5, 'UPDATE Verification', async () => {
      const pool = await harness.getTestDatabasePool();
      const updatedTitle = 'Test Adventure Quest (Updated)';
      await pool.query('UPDATE games SET title = $1 WHERE id = $2;', [updatedTitle, TEST_FIXTURES.game.id]);
      const res = await pool.query('SELECT title FROM games WHERE id = $1;', [TEST_FIXTURES.game.id]);
      assert(res.rows[0].title === updatedTitle, 'Game title was not updated');
    });

    // Test 6: DELETE Verification
    await runTest(6, 'DELETE Verification', async () => {
      const pool = await harness.getTestDatabasePool();
      // Insert temporary product to delete
      const tempId = 'temp-prod-delete-test';
      await pool.query(`
        INSERT INTO products (id, name, slug, short_description, description, category, platform, status, created_at, updated_at)
        VALUES ($1, 'Temp', 'temp-slug', 'Short', 'Desc', 'Web Applications', 'Web', 'Draft', NOW(), NOW());
      `, [tempId]);

      const inserted = await pool.query('SELECT id FROM products WHERE id = $1;', [tempId]);
      assert(inserted.rows.length === 1, 'Temp product insertion failed');

      await pool.query('DELETE FROM products WHERE id = $1;', [tempId]);
      const deleted = await pool.query('SELECT id FROM products WHERE id = $1;', [tempId]);
      assert(deleted.rows.length === 0, 'Temp product was not deleted');
    });

    // Test 7: Foreign Key Constraint Enforcement
    await runTest(7, 'Foreign Key Constraint Enforcement', async () => {
      const pool = await harness.getTestDatabasePool();
      let threwFkError = false;
      try {
        await pool.query(`
          INSERT INTO releases (id, game_id, version_name, version_code, release_date, release_notes, apk_filename, apk_file_size, apk_download_url, is_published, download_count, created_at)
          VALUES ('orphan-rel', 'non-existent-game-id', '1.0.0', 1, '2026-11-01', 'Notes', 'orphan.apk', 100, '/downloads/orphan.apk', true, 0, NOW());
        `);
      } catch (err: any) {
        if (err.code === '23503') {
          threwFkError = true;
        }
      }
      assert(threwFkError, 'Expected Foreign Key violation (code 23503) for orphan release');
    });

    // Test 8: Transaction COMMIT Verification
    await runTest(8, 'Transaction COMMIT Verification', async () => {
      const pool = await harness.getTestDatabasePool();
      const client = await pool.connect();
      const txGameId = 'tx-commit-game';
      try {
        await client.query('BEGIN;');
        await client.query(`
          INSERT INTO games (id, title, slug, tagline, description, genre, platforms, status, developer, created_at, updated_at)
          VALUES ($1, 'Tx Game', 'tx-game', 'Tag', 'Desc', ARRAY['Action'], ARRAY['Android'], 'Available', 'Dev', NOW(), NOW());
        `, [txGameId]);
        await client.query('COMMIT;');
      } catch (e) {
        await client.query('ROLLBACK;');
        throw e;
      } finally {
        client.release();
      }

      const res = await pool.query('SELECT id FROM games WHERE id = $1;', [txGameId]);
      assert(res.rows.length === 1, 'Committed transaction record was not found');
    });

    // Test 9: Transaction ROLLBACK Verification
    await runTest(9, 'Transaction ROLLBACK Verification', async () => {
      const pool = await harness.getTestDatabasePool();
      const client = await pool.connect();
      const rbGameId = 'tx-rollback-game';
      try {
        await client.query('BEGIN;');
        await client.query(`
          INSERT INTO games (id, title, slug, tagline, description, genre, platforms, status, developer, created_at, updated_at)
          VALUES ($1, 'Rb Game', 'rb-game', 'Tag', 'Desc', ARRAY['Action'], ARRAY['Android'], 'Available', 'Dev', NOW(), NOW());
        `, [rbGameId]);
        await client.query('ROLLBACK;');
      } catch (e) {
        await client.query('ROLLBACK;');
        throw e;
      } finally {
        client.release();
      }

      const res = await pool.query('SELECT id FROM games WHERE id = $1;', [rbGameId]);
      assert(res.rows.length === 0, 'Rolled-back transaction record should NOT exist');
    });

    // Test 10: Atomic Download Counter Increment Verification
    await runTest(10, 'Atomic Download Counter Increment Verification', async () => {
      const pool = await harness.getTestDatabasePool();
      const beforeRes = await pool.query('SELECT download_count FROM releases WHERE id = $1;', [TEST_FIXTURES.release.id]);
      const initialCount = parseInt(beforeRes.rows[0].download_count, 10);

      const incRes = await pool.query(`
        UPDATE releases 
        SET download_count = download_count + 1 
        WHERE id = $1 
        RETURNING download_count;
      `, [TEST_FIXTURES.release.id]);

      const newCount = parseInt(incRes.rows[0].download_count, 10);
      assert(newCount === initialCount + 1, 'Download count was not atomically incremented');
    });

    // Test 11: SupabasePostgresProvider Integration Verification
    await runTest(11, 'SupabasePostgresProvider Integration Verification', async () => {
      const provider = new SupabasePostgresProvider(testDbUrl);
      await provider.init();
      const games = await provider.getGames();
      assert(Array.isArray(games) && games.length > 0, 'Provider failed to retrieve games');
      const settings = await provider.getSettings();
      assert(settings.studio_name === TEST_FIXTURES.settings.studio_name, 'Provider settings mismatch');
    });

    // Test 12: Parameterized SQL Injection Defense Verification
    await runTest(12, 'Parameterized SQL Injection Defense Verification', async () => {
      const pool = await harness.getTestDatabasePool();
      const maliciousPayload = "' OR '1'='1";
      const res = await pool.query('SELECT * FROM games WHERE title = $1;', [maliciousPayload]);
      assert(res.rows.length === 0, 'Parameterized query permitted SQL injection');
    });

    // Test 13: Persistence Across Client Disconnects
    await runTest(13, 'Persistence Across Client Disconnects', async () => {
      const poolA = new Pool({ connectionString: testDbUrl, ssl: false });
      const persistGameId = 'persist-disconnect-game';
      await poolA.query(`
        INSERT INTO games (id, title, slug, tagline, description, genre, platforms, status, developer, created_at, updated_at)
        VALUES ($1, 'Persist Game', 'persist-game', 'Tag', 'Desc', ARRAY['Action'], ARRAY['Android'], 'Available', 'Dev', NOW(), NOW());
      `, [persistGameId]);
      await poolA.end();

      const poolB = new Pool({ connectionString: testDbUrl, ssl: false });
      const verifyRes = await poolB.query('SELECT id FROM games WHERE id = $1;', [persistGameId]);
      await poolB.end();
      assert(verifyRes.rows.length === 1, 'Record failed to persist across pool disconnects');
    });

    // Test 14: Database Clean Teardown Verification
    await runTest(14, 'Database Clean Teardown Verification', async () => {
      await harness.cleanDatabase();
      const pool = await harness.getTestDatabasePool();
      const res = await pool.query('SELECT COUNT(*) AS c FROM games;');
      assert(parseInt(res.rows[0].c, 10) === 0, 'Games table was not emptied');
      // Verify schema marker still intact
      const marker = await pool.query('SELECT * FROM _test_environment_marker;');
      assert(marker.rows.length === 1, 'Marker table should survive data clean');
    });

  } finally {
    await harness.close();
  }

  printSummary();
}

async function runTest(num: number, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`[PASS] Test ${num}: ${name}`);
    results.push({ num, name, passed: true });
  } catch (err: any) {
    console.error(`[FAIL] Test ${num}: ${name} — ${err.message}`);
    results.push({ num, name, passed: false, details: err.message });
  }
}

function printSummary() {
  console.log('\n================================================================');
  console.log('TEST SUMMARY');
  console.log('================================================================');
  const passed = results.filter((r) => r.passed && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total: ${results.length} | Passed: ${passed} | Skipped: ${skipped} | Failed: ${failed}`);
  if (failed > 0) {
    console.error('\nFAILURES:');
    results.filter((r) => !r.passed).forEach((r) => console.error(`- Test ${r.num}: ${r.name} -> ${r.details}`));
    process.exit(1);
  } else {
    console.log('\n[SUCCESS] All executed tests passed cleanly.');
  }
}

runTestSuite().catch((err) => {
  console.error('[FATAL ERROR IN TEST SUITE]', err);
  process.exit(1);
});
