import pg from 'pg';
import { SupabasePostgresProvider } from '../server/database/SupabasePostgresProvider.js';
import { validateTestDatabaseUrl, assertTestDatabaseIsolation } from '../server/testing/testDatabaseGuard.js';
import { TEST_FIXTURES } from '../server/testing/testFixtures.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
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

export async function runAtomicCounterTests(): Promise<TestReport[]> {
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.2 ATOMIC DOWNLOAD COUNTER CONCURRENCY TESTS');
  console.log('================================================================\n');

  const testDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://karsh_test_user:KarshTestSecurePassword2026!@127.0.0.1:5433/karsh_tech_test';
  const prodUrl = process.env.DATABASE_URL;

  // 1. Guard check
  const guard = validateTestDatabaseUrl(testDbUrl, prodUrl, true);
  assert(guard.allowed, `Guard rejected test URL: ${guard.reason}`);

  const testPool = new Pool({
    connectionString: testDbUrl,
    ssl: false,
    connectionTimeoutMillis: 5000,
  });

  await assertTestDatabaseIsolation(testPool, {
    candidateUrl: testDbUrl,
    productionUrl: prodUrl,
    strictDockerMode: true,
    requireMarker: true,
  });

  const provider = new SupabasePostgresProvider(testDbUrl);
  await provider.init();

  const counterRelId = 'test_rel_counter_concurrency';

  try {
    // Setup dedicated test release
    const client = await testPool.connect();
    try {
      await client.query('DELETE FROM releases WHERE id = $1;', [counterRelId]);
      await client.query(`
        INSERT INTO releases (id, game_id, version_name, apk_filename, download_count)
        VALUES ($1, $2, '1.0.0-counter', 'counter.apk', 0);
      `, [counterRelId, TEST_FIXTURES.game.id]);
    } finally {
      client.release();
    }

    // ------------------------------------------------------------------------
    // SEQUENTIAL INCREMENT
    // ------------------------------------------------------------------------
    console.log('--- 1. Sequential Increments ---');

    await run(1, 'Counter', 'Single incrementDownload advances count by exactly 1', async () => {
      const newCount = await provider.incrementDownload(counterRelId);
      assert(newCount === 1, `Expected 1, got ${newCount}`);

      const rel = await provider.getReleaseById(counterRelId);
      assert(rel!.download_count === 1, `Database value mismatch: expected 1, got ${rel!.download_count}`);
    });

    await run(2, 'Counter', 'Repeated sequential calls advance count predictably', async () => {
      for (let i = 2; i <= 5; i++) {
        const count = await provider.incrementDownload(counterRelId);
        assert(count === i, `Expected ${i}, got ${count}`);
      }
      const rel = await provider.getReleaseById(counterRelId);
      assert(rel!.download_count === 5, `Expected 5, got ${rel!.download_count}`);
    });

    // ------------------------------------------------------------------------
    // CONCURRENT INCREMENTS (RACE CONDITION DEFENSE)
    // ------------------------------------------------------------------------
    console.log('\n--- 2. High-Concurrency Race Condition Defense ---');

    await run(3, 'Concurrency', '25 parallel concurrent increments lose zero updates', async () => {
      const concurrencyCount = 25;
      const initialCount = 5;

      // Fire 25 simultaneous promises without awaiting in a loop
      const promises: Promise<number>[] = [];
      for (let i = 0; i < concurrencyCount; i++) {
        promises.push(provider.incrementDownload(counterRelId));
      }

      const results = await Promise.all(promises);
      assert(results.length === concurrencyCount, 'All concurrent promises resolved');

      // Verify final database count is exactly initialCount + concurrencyCount
      const expectedFinal = initialCount + concurrencyCount;
      const rel = await provider.getReleaseById(counterRelId);
      assert(rel!.download_count === expectedFinal, `Lost update detected! Expected ${expectedFinal}, got ${rel!.download_count}`);

      // Verify all returned numbers are unique (each atomic statement sees a distinct number)
      const uniqueResults = new Set(results);
      assert(uniqueResults.size === concurrencyCount, `Duplicate counter values observed among concurrent callers (${uniqueResults.size} vs ${concurrencyCount})`);
    });

    // ------------------------------------------------------------------------
    // EDGE CASES & ROLLBACK
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Edge Cases & Transaction Isolation ---');

    await run(4, 'EdgeCases', 'Non-existent release ID returns 0 safely without error', async () => {
      const count = await provider.incrementDownload('nonexistent-release-uuid-999');
      assert(count === 0, `Expected 0 for non-existent release, got ${count}`);
    });

    await run(5, 'Rollback', 'Aborted transaction does not alter download counter', async () => {
      const beforeRel = await provider.getReleaseById(counterRelId);
      const countBefore = beforeRel!.download_count;

      const txClient = await testPool.connect();
      try {
        await txClient.query('BEGIN;');
        await txClient.query(`
          UPDATE releases
          SET download_count = download_count + 100
          WHERE id = $1;
        `, [counterRelId]);
        await txClient.query('ROLLBACK;');
      } finally {
        txClient.release();
      }

      const afterRel = await provider.getReleaseById(counterRelId);
      assert(afterRel!.download_count === countBefore, `Rollback failed! Expected ${countBefore}, got ${afterRel!.download_count}`);
    });

    // Clean up
    const cleanClient = await testPool.connect();
    try {
      await cleanClient.query('DELETE FROM releases WHERE id = $1;', [counterRelId]);
    } finally {
      cleanClient.release();
    }

  } finally {
    await provider.close();
    await testPool.end();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`ATOMIC COUNTER SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Atomic Counter Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_atomic_counter.ts')) {
  runAtomicCounterTests().catch(err => {
    console.error('[FATAL ERROR IN ATOMIC COUNTER SUITE]', err);
    process.exit(1);
  });
}
