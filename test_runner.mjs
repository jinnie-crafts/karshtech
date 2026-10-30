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

  console.log('\n[Test Runner] ALL SUITES PASSED WITH 100% SUCCESS!');
  process.exit(0);
} catch (err) {
  console.error('\n[Test Runner] Test suite failed:', err);
  process.exit(1);
}
