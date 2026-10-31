if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {}
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'bd1db785e67e77696c8bd980f162806b70ac4d2390dfbe59ccc7ce24797e5ab7698da9c5a9b55e0f2f1e03ed1e497959621611f439c926729bf74f8067680f1f';

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
