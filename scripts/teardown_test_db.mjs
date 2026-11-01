if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch {
    console.error('[teardown_test_db FATAL] .env.test is missing.');
    process.exit(1);
  }
}

import { TestHarness } from '../server/testing/testHarness.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';

async function main() {
  console.log('=== KARSH TECH — ISOLATED TEST DATABASE TEARDOWN ===');
  const testDbUrl = process.env.TEST_DATABASE_URL;

  const val = validateTestDatabaseUrl(testDbUrl, process.env.DATABASE_URL, true);
  if (!val.allowed) {
    console.error(`[FATAL] Test Database Guard Rejection: ${val.reason}`);
    process.exit(1);
  }

  console.log(`Connecting to isolated test database on ${val.databaseHost}:${val.databasePort}/${val.databaseName} for clean teardown...`);
  const harness = new TestHarness({ testDatabaseUrl: testDbUrl });

  try {
    await harness.cleanDatabase();
    console.log('\n[SUCCESS] Isolated test database has been cleanly purged and reset.');
  } catch (err) {
    console.error('[FATAL] Failed to teardown test database:', err.message);
    process.exit(1);
  } finally {
    await harness.close();
  }
}

main();
