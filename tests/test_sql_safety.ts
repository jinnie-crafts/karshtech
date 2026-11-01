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

export async function runSqlSafetyTests(): Promise<TestReport[]> {
  console.log('================================================================');
  console.log('KARSH TECH — PHASE 4.3.2 SQL SAFETY & PARAMETERIZATION TESTS');
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

  try {
    // ------------------------------------------------------------------------
    // SQL INJECTION DEFENSE (READ OPERATIONS)
    // ------------------------------------------------------------------------
    console.log('--- 1. SQL Injection Defense (Read Queries) ---');

    await run(1, 'Injection', 'Classic boolean tautology in getGameBySlug', async () => {
      const payload = "' OR '1'='1";
      const res = await provider.getGameBySlug(payload);
      assert(res === undefined, 'Expected undefined for injected slug payload');
    });

    await run(2, 'Injection', 'Inline comment and boolean OR in getGameBySlug', async () => {
      const payload = "test-space-odyssey' OR 1=1 --";
      const res = await provider.getGameBySlug(payload);
      assert(res === undefined, 'Expected undefined for injected slug payload');
    });

    await run(3, 'Injection', 'Stacked DROP TABLE query in getGameBySlug', async () => {
      const payload = "test-space-odyssey'; DROP TABLE games CASCADE; --";
      const res = await provider.getGameBySlug(payload);
      assert(res === undefined, 'Stacked injection returned data');

      // Verify table still exists and data intact
      const check = await provider.getGameById(TEST_FIXTURES.game.id);
      assert(check !== undefined, 'Games table was destroyed by SQL injection');
    });

    await run(4, 'Injection', 'UNION-based attack in getUserByUsername', async () => {
      const payload = "admin' UNION SELECT 'hacked', 'hacked', 'hacked', 'superadmin', NOW() --";
      const res = await provider.getUserByUsername(payload);
      assert(res === undefined, 'UNION attack succeeded in getUserByUsername');
    });

    await run(5, 'Injection', 'Stacked DELETE attempt in getUserByUsername', async () => {
      const payload = "test_admin'; DELETE FROM users; --";
      const res = await provider.getUserByUsername(payload);
      assert(res === undefined, 'Stacked DELETE returned data');

      // Verify users table intact
      const check = await provider.getUserById(TEST_FIXTURES.user.id);
      assert(check !== undefined, 'Users table was damaged by SQL injection');
    });

    // ------------------------------------------------------------------------
    // UNINTENDED COLUMN MODIFICATION DEFENSE
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Column Allowlist Protection ---');

    await run(6, 'Allowlist', 'updateGame ignores unpermitted columns and protects primary key', async () => {
      const baseline = await provider.getGameById(TEST_FIXTURES.game.id);
      assert(baseline !== undefined, 'Baseline game must exist');

      const maliciousUpdates: any = {
        id: 'compromised-game-id',
        created_at: '1970-01-01T00:00:00.000Z',
        non_existent_column: 'arbitrary_value',
        title: 'Safely Updated Title',
      };

      const result = await provider.updateGame(TEST_FIXTURES.game.id, maliciousUpdates);
      assert(result !== null, 'updateGame returned null');
      assert(result!.id === TEST_FIXTURES.game.id, 'Primary key id was modified');
      assert(result!.created_at === baseline!.created_at, 'created_at timestamp was modified');
      assert(result!.title === 'Safely Updated Title', 'Permitted column title was updated');

      // Revert title
      await provider.updateGame(TEST_FIXTURES.game.id, { title: TEST_FIXTURES.game.title });
    });

    await run(7, 'Allowlist', 'updateProduct ignores unpermitted columns and protects primary key', async () => {
      const baseline = await provider.getProductById(TEST_FIXTURES.product.id);
      assert(baseline !== undefined, 'Baseline product must exist');

      const maliciousUpdates: any = {
        id: 'compromised-product-id',
        created_at: '1970-01-01T00:00:00.000Z',
        admin_flag: true,
        short_description: 'Safely updated short description',
      };

      const result = await provider.updateProduct(TEST_FIXTURES.product.id, maliciousUpdates);
      assert(result !== null, 'updateProduct returned null');
      assert(result!.id === TEST_FIXTURES.product.id, 'Product id was modified');
      assert(result!.created_at === baseline!.created_at, 'created_at was modified');
      assert(result!.short_description === 'Safely updated short description', 'Short description was updated');

      // Revert description
      await provider.updateProduct(TEST_FIXTURES.product.id, { short_description: TEST_FIXTURES.product.short_description });
    });

    // ------------------------------------------------------------------------
    // MISSING RECORD HANDLING CONSISTENCY
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Missing Records Handling Consistency ---');

    await run(8, 'MissingRecords', 'Lookup queries return undefined for non-existent IDs', async () => {
      assert((await provider.getGameById('missing-id')) === undefined, 'getGameById');
      assert((await provider.getGameBySlug('missing-slug')) === undefined, 'getGameBySlug');
      assert((await provider.getReleaseById('missing-id')) === undefined, 'getReleaseById');
      assert((await provider.getProductById('missing-id')) === undefined, 'getProductById');
      assert((await provider.getProductBySlug('missing-slug')) === undefined, 'getProductBySlug');
      assert((await provider.getUserById('missing-id')) === undefined, 'getUserById');
      assert((await provider.getUserByUsername('missing-username')) === undefined, 'getUserByUsername');
    });

    await run(9, 'MissingRecords', 'Update queries return null for non-existent IDs', async () => {
      assert((await provider.updateGame('missing-id', { title: 'X' })) === null, 'updateGame');
      assert((await provider.updateRelease('missing-id', { version_name: 'X' })) === null, 'updateRelease');
      assert((await provider.updateProduct('missing-id', { name: 'X' })) === null, 'updateProduct');
    });

    await run(10, 'MissingRecords', 'Delete queries return false for non-existent IDs', async () => {
      assert((await provider.deleteGame('missing-id')) === false, 'deleteGame');
      assert((await provider.deleteRelease('missing-id')) === false, 'deleteRelease');
      assert((await provider.deleteProduct('missing-id')) === false, 'deleteProduct');
    });

    // ------------------------------------------------------------------------
    // ERROR SANITIZATION
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Error Message Sanitization ---');

    await run(11, 'Sanitization', 'Database errors do not leak connection strings or passwords', async () => {
      const client = await testPool.connect();
      let caughtErrorMsg = '';
      try {
        await client.query('SELECT * FROM nonexistent_table_xyz_123;');
      } catch (err: any) {
        caughtErrorMsg = err.message || '';
      } finally {
        client.release();
      }

      assert(caughtErrorMsg.length > 0, 'Error was not thrown');
      assert(!caughtErrorMsg.includes('KarshTestSecurePassword'), 'Error exposed test database password');
      assert(!caughtErrorMsg.includes('postgresql://'), 'Error exposed raw connection string URL');
    });

  } finally {
    await provider.close();
    await testPool.end();
  }

  const passed = reports.filter(r => r.passed).length;
  const failed = reports.filter(r => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(`SQL SAFETY SUITE: ${reports.length} Tests | ${passed} Passed | ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in SQL Safety Suite`);
  }

  return reports;
}

if (process.argv[1]?.endsWith('test_sql_safety.ts')) {
  runSqlSafetyTests().catch(err => {
    console.error('[FATAL ERROR IN SQL SAFETY SUITE]', err);
    process.exit(1);
  });
}
