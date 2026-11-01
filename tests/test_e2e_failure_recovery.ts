import http from 'http';
import { app } from '../server/index.js';
import { setDatabaseProvider } from '../server/db.js';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch {}
}

export interface TestReport {
  num: number;
  name: string;
  category: string;
  passed: boolean;
  error?: string;
}

export async function runFailureRecoveryTests(): Promise<TestReport[]> {
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
  console.log('KARSH TECH — PHASE 4.3.4 FAILURE RECOVERY & EDGE CASE AUDIT');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  const postgresProvider = new SupabasePostgresProvider(testDbUrl);
  await postgresProvider.init();
  setDatabaseProvider(postgresProvider);

  let server: http.Server;
  let baseUrl: string;

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  try {
    // --- 1. Database Connection & Config Failures ---
    console.log('--- 1. Database Connection & Config Failures ---');

    await run('FailureRecovery', 'Connecting to unavailable port fails with connect error and does not hang', async () => {
      const badProvider = new SupabasePostgresProvider('postgresql://karsh_test_user:pass@127.0.0.1:5439/nonexistent');
      let threw = false;
      try {
        await badProvider.init();
      } catch (err: any) {
        threw = true;
        assert(Boolean(err.message), 'Error message is returned');
      }
      assert(threw, 'Must throw when connecting to unavailable port');
    });

    await run('FailureRecovery', 'Malformed database URL is rejected with error', async () => {
      let threw = false;
      try {
        const badProvider = new SupabasePostgresProvider('not-a-valid-connection-string');
        await badProvider.init();
      } catch {
        threw = true;
      }
      assert(threw, 'Must throw on malformed database connection string');
    });

    // --- 2. Database Constraint Violations ---
    console.log('\n--- 2. Database Constraint & Integrity Violations ---');

    await run('FailureRecovery', 'Duplicate slug insertion violates unique constraint safely', async () => {
      const uniqueSlug = `recovery-test-${Date.now()}`;
      const game1 = await postgresProvider.createGame({
        title: 'Original Game',
        slug: uniqueSlug,
        status: 'Available',
      });

      let threw = false;
      try {
        await postgresProvider.createGame({
          title: 'Duplicate Game',
          slug: uniqueSlug,
          status: 'Available',
        });
      } catch (err: any) {
        threw = true;
        // PostgreSQL code 23505 is unique_violation
        assert(err.code === '23505', `Expected code 23505, got ${err.code}`);
      } finally {
        await postgresProvider.deleteGame(game1.id);
      }
      assert(threw, 'Must throw on unique constraint violation');
    });

    await run('FailureRecovery', 'Release creation with non-existent game_id violates foreign key constraint', async () => {
      let threw = false;
      try {
        await postgresProvider.createRelease({
          game_id: 'non_existent_game_999999',
          version_name: 'v1.0.0',
          version_code: 1,
          release_date: '2026-11-01',
          apk_filename: 'fake.apk',
          original_filename: 'fake.apk',
          apk_file_size: 1024,
          is_published: false,
        });
      } catch (err: any) {
        threw = true;
        // PostgreSQL code 23503 is foreign_key_violation
        assert(err.code === '23503', `Expected code 23503, got ${err.code}`);
      }
      assert(threw, 'Must throw on foreign key violation');
    });

    // --- 3. Empty & Missing Entity Handling ---
    console.log('\n--- 3. Safe Handling of Missing & Empty Result Sets ---');

    await run('FailureRecovery', 'GET /api/games/:slug with non-existent slug returns 404 JSON', async () => {
      const res = await fetch(`${baseUrl}/api/games/completely-non-existent-game-slug-404`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('not found') === true, 'Returns structured 404 error');
    });

    await run('FailureRecovery', 'GET /api/products/:slug with non-existent slug returns 404 JSON', async () => {
      const res = await fetch(`${baseUrl}/api/products/completely-non-existent-product-slug-404`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('not found') === true, 'Returns structured 404 error');
    });

    await run('FailureRecovery', 'GET /api/releases/:id/download with non-existent ID returns 404 JSON', async () => {
      const res = await fetch(`${baseUrl}/api/releases/rel_nonexistent_id_404/download`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      const body = await res.json();
      assert(body.error?.includes('not found') === true, 'Returns structured 404 error');
    });

  } finally {
    server.close();
    await postgresProvider.close();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`FAILURE RECOVERY SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Failure Recovery Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_e2e_failure_recovery.ts')) {
  runFailureRecoveryTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL ERROR IN FAILURE RECOVERY SUITE]', err);
      process.exit(1);
    });
}
