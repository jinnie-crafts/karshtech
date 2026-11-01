if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

process.env.DB_PROVIDER = process.env.DB_PROVIDER || 'json';
process.env.TEST_JWT_SECRET = process.env.TEST_JWT_SECRET || 'test_jwt_secret_dev_only_not_for_production_min32chars_test';

// Start the server directly within the test runner process
console.log('[Test Runner] Starting server...');
await import('./server/index.ts');

// Wait 1.5 seconds for server to bind port 3001
await new Promise((resolve) => setTimeout(resolve, 1500));
console.log('[Test Runner] Server listening. Launching test suites...\n');

try {
  const productsSuite = await import('./test_products_api.mjs');
  await productsSuite.run();

  const authSuite = await import('./test_auth.mjs');
  await authSuite.run();

  const releasesSuite = await import('./test_releases_workflow.mjs');
  await releasesSuite.run();

  const persistenceSuite = await import('./test_persistence.mjs');
  await persistenceSuite.run();

  console.log('\n[Test Runner] ALL SUITES PASSED WITH 100% SUCCESS!');
  process.exit(0);
} catch (err) {
  console.error('\n[Test Runner] Test suite failed:', err);
  process.exit(1);
}
