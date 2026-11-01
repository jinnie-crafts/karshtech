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

export async function runTransactionsRecoveryTests(): Promise<TestReport[]> {
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.2 TRANSACTIONS & FAILURE RECOVERY TESTS');
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

  try {
    // ------------------------------------------------------------------------
    // TRANSACTION COMMIT & ROLLBACK
    // ------------------------------------------------------------------------
    console.log('--- 1. Transaction Atomic Commit & Rollback ---');

    await run(1, 'Transactions', 'Successful multi-step transaction commits parent and child atomically', async () => {
      const txGameId = 'test_tx_commit_game';
      const txRelId = 'test_tx_commit_rel';
      const client = await testPool.connect();

      try {
        await client.query('BEGIN;');
        await client.query(`
          INSERT INTO games (id, title, slug, status, developer)
          VALUES ($1, 'Tx Commit Game', 'tx-commit-game', 'Available', 'Tx Test Lab');
        `, [txGameId]);

        await client.query(`
          INSERT INTO releases (id, game_id, version_name, apk_filename)
          VALUES ($1, $2, '1.0.0-tx', 'tx-commit.apk');
        `, [txRelId, txGameId]);

        await client.query('COMMIT;');
      } catch (e) {
        await client.query('ROLLBACK;');
        throw e;
      } finally {
        client.release();
      }

      // Verify both records exist
      const gRes = await testPool.query('SELECT id FROM games WHERE id = $1;', [txGameId]);
      const rRes = await testPool.query('SELECT id FROM releases WHERE id = $1;', [txRelId]);
      assert(gRes.rows.length === 1, 'Game was not committed');
      assert(rRes.rows.length === 1, 'Release was not committed');

      // Cleanup
      await testPool.query('DELETE FROM games WHERE id = $1;', [txGameId]);
    });

    await run(2, 'Transactions', 'Explicit ROLLBACK discards all uncommitted writes', async () => {
      const rbGameId = 'test_tx_rollback_game';
      const client = await testPool.connect();

      try {
        await client.query('BEGIN;');
        await client.query(`
          INSERT INTO games (id, title, slug, status, developer)
          VALUES ($1, 'Tx Rollback Game', 'tx-rollback-game', 'Available', 'Tx Test Lab');
        `, [rbGameId]);
        await client.query('ROLLBACK;');
      } finally {
        client.release();
      }

      const res = await testPool.query('SELECT id FROM games WHERE id = $1;', [rbGameId]);
      assert(res.rows.length === 0, 'Rolled-back record unexpectedly exists in database');
    });

    await run(3, 'Transactions', 'Error during multi-step operation rolls back partial writes completely', async () => {
      const parentId = 'test_tx_parent_failed';
      const client = await testPool.connect();
      let threw = false;

      try {
        await client.query('BEGIN;');
        // Step 1: Insert parent
        await client.query(`
          INSERT INTO games (id, title, slug, status, developer)
          VALUES ($1, 'Tx Parent Failed', 'tx-parent-failed', 'Available', 'Tx Test Lab');
        `, [parentId]);

        // Step 2: Attempt invalid child insert that violates CHECK constraint
        await client.query(`
          INSERT INTO products (id, name, slug, category, status)
          VALUES ('invalid-tx-prod', 'Bad Prod', 'bad-slug', 'NonExistentCategory', 'Draft');
        `);

        await client.query('COMMIT;');
      } catch (err: any) {
        threw = true;
        await client.query('ROLLBACK;');
      } finally {
        client.release();
      }

      assert(threw, 'Multi-step error was not thrown');
      const checkParent = await testPool.query('SELECT id FROM games WHERE id = $1;', [parentId]);
      assert(checkParent.rows.length === 0, 'Partial parent record survived rollback');
    });

    // ------------------------------------------------------------------------
    // POOL MANAGEMENT & EXHAUSTION RECOVERY
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Pool Exhaustion & Recovery ---');

    await run(4, 'Pool', 'Pool with max=2 queues requests and recovers without deadlock', async () => {
      const microPool = new Pool({
        connectionString: testDbUrl,
        ssl: false,
        max: 2,
        connectionTimeoutMillis: 3000,
      });

      try {
        // Acquire both connections
        const client1 = await microPool.connect();
        const client2 = await microPool.connect();

        let client3Acquired = false;

        // Start request that must wait for available connection
        const pending3 = microPool.connect().then(c3 => {
          client3Acquired = true;
          c3.release();
        });

        // Verify client 3 is queued while pool is saturated
        await new Promise(r => setTimeout(r, 100));
        assert(client3Acquired === false, 'Client 3 acquired connection before release');

        // Release client 1 to satisfy queue
        client1.release();
        await pending3;
        assert(client3Acquired === true, 'Client 3 acquired connection from queue');

        client2.release();
      } finally {
        await microPool.end();
      }
    });

    // ------------------------------------------------------------------------
    // DATABASE UNAVAILABLE DURING STARTUP
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Database Startup Failure & Recovery ---');

    await run(5, 'StartupFailure', 'Provider initialization fails cleanly when database is unreachable', async () => {
      const unreachableUrl = 'postgresql://karsh_test_user:wrong@127.0.0.1:5499/karsh_tech_test';
      const failingProvider = new SupabasePostgresProvider(unreachableUrl);

      let caughtError = false;
      try {
        await failingProvider.init();
      } catch (err: any) {
        caughtError = true;
      } finally {
        await failingProvider.close();
      }

      assert(caughtError === true, 'Provider did not throw when connecting to dead port');
    });

    // ------------------------------------------------------------------------
    // GRACEFUL SHUTDOWN & REINITIALIZATION
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Graceful Shutdown & Reinitialization ---');

    await run(6, 'Lifecycle', 'Provider gracefully shuts down and fresh instance reinitializes cleanly', async () => {
      const provider1 = new SupabasePostgresProvider(testDbUrl);
      await provider1.init();
      assert((await provider1.getGames()).length > 0, 'Provider 1 active');

      // Gracefully close
      await provider1.close();

      // Ensure queries on closed pool throw error
      let queryOnClosedThrew = false;
      try {
        await provider1.getGames();
      } catch {
        queryOnClosedThrew = true;
      }
      assert(queryOnClosedThrew === true, 'Query on closed pool should fail');

      // Reinitialize fresh provider instance
      const provider2 = new SupabasePostgresProvider(testDbUrl);
      await provider2.init();
      const games = await provider2.getGames();
      assert(games.length > 0, 'Provider 2 reinitialized and retrieved games successfully');
      await provider2.close();
    });

  } finally {
    await testPool.end();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`TRANSACTIONS & RECOVERY SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Transactions & Recovery Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_transactions_recovery.ts')) {
  runTransactionsRecoveryTests().catch(err => {
    console.error('[FATAL ERROR IN TRANSACTIONS SUITE]', err);
    process.exit(1);
  });
}
