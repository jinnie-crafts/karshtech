if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.test');
  } catch {
    console.error('[setup_test_db FATAL] .env.test is missing. Copy .env.test.example to .env.test first.');
    process.exit(1);
  }
}

import { TestHarness } from '../server/testing/testHarness.js';
import { validateTestDatabaseUrl } from '../server/testing/testDatabaseGuard.js';

async function main() {
  console.log('=== KARSH TECH — ISOLATED TEST DATABASE SETUP ===');
  const testDbUrl = process.env.TEST_DATABASE_URL;

  const val = validateTestDatabaseUrl(testDbUrl, process.env.DATABASE_URL, true);
  if (!val.allowed) {
    console.error(`[FATAL] Test Database Guard Rejection: ${val.reason}`);
    process.exit(1);
  }

  console.log(`Connecting to isolated test database on ${val.databaseHost}:${val.databasePort}/${val.databaseName}...`);
  const harness = new TestHarness({ testDatabaseUrl: testDbUrl });

  try {
    await harness.applySchema();
    await harness.seedFixtures();
    console.log('\n[SUCCESS] Isolated test database is fully schema-migrated, marked, and seeded.');
  } catch (err) {
    console.error('[FATAL] Failed to setup test database:', err.message);
    process.exit(1);
  } finally {
    await harness.close();
  }
}

main();
